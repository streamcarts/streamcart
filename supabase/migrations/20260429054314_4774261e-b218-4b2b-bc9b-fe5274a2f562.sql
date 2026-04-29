
-- 1) Chat message: image support
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS chat_image_path TEXT;

-- Allow 'image' as a kind (kind is just text, no enum). No constraint change needed.

-- 2) Read tracking on order_chats
ALTER TABLE public.order_chats
  ADD COLUMN IF NOT EXISTS buyer_last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS seller_last_read_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 3) Mark chat as read for current user
CREATE OR REPLACE FUNCTION public.mark_chat_read(_chat_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _c public.order_chats%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT * INTO _c FROM public.order_chats WHERE id = _chat_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF auth.uid() = _c.buyer_id THEN
    UPDATE public.order_chats SET buyer_last_read_at = now() WHERE id = _chat_id;
  ELSIF auth.uid() = _c.seller_id THEN
    UPDATE public.order_chats SET seller_last_read_at = now() WHERE id = _chat_id;
  END IF;
END $$;

-- 4) Send chat image (called by edge function with verdict)
CREATE OR REPLACE FUNCTION public.send_chat_image(
  _chat_id UUID,
  _image_path TEXT,
  _ocr_text TEXT,
  _contact_detected BOOLEAN,
  _detect_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _chat public.order_chats%ROWTYPE;
  _uid UUID := auth.uid();
  _msg_id UUID;
  _is_seller BOOLEAN;
  _flag_count INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _image_path IS NULL OR length(_image_path) = 0 THEN RAISE EXCEPTION 'Image required'; END IF;

  SELECT * INTO _chat FROM public.order_chats WHERE id = _chat_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chat not found'; END IF;
  IF _uid <> _chat.buyer_id AND _uid <> _chat.seller_id THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;
  IF _chat.status = 'cancelled' THEN RAISE EXCEPTION 'Chat closed'; END IF;

  _is_seller := (_uid = _chat.seller_id);

  IF _contact_detected THEN
    INSERT INTO public.chat_messages (chat_id, sender_id, kind, body, is_flagged, flag_reason, is_blocked, chat_image_path)
    VALUES (_chat_id, _uid, 'image',
      '⚠️ Image blocked: contact info (' || COALESCE(_detect_reason,'unknown') || ') detected by automated scan.',
      true, _detect_reason, true, _image_path)
    RETURNING id INTO _msg_id;

    IF _is_seller THEN
      INSERT INTO public.seller_flags (seller_id, message_id, chat_id, reason, severity, message_preview)
      VALUES (_uid, _msg_id, _chat_id, COALESCE(_detect_reason,'image_contact'), 'high', left(COALESCE(_ocr_text,''), 200));

      SELECT count(*) INTO _flag_count FROM public.seller_flags
        WHERE seller_id = _uid AND resolved = false AND severity = 'high';
      IF _flag_count >= 3 THEN
        UPDATE public.profiles SET is_banned = true,
          ban_reason = COALESCE(ban_reason, 'Auto-ban: contact-info sharing in chat (image)')
          WHERE id = _uid;
      END IF;
    ELSE
      INSERT INTO public.fraud_flags (user_id, signal, severity, metadata)
      VALUES (_uid, 'buyer_image_contact_share', 'low',
              jsonb_build_object('chat_id', _chat_id, 'reason', _detect_reason));
    END IF;

    RETURN _msg_id;
  END IF;

  INSERT INTO public.chat_messages (chat_id, sender_id, kind, body, chat_image_path)
  VALUES (_chat_id, _uid, 'image', NULL, _image_path)
  RETURNING id INTO _msg_id;

  UPDATE public.order_chats SET updated_at = now() WHERE id = _chat_id;
  RETURN _msg_id;
END $$;

-- 5) Storage bucket for chat images (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: {chat_id}/{uuid}.{ext}
-- Allow buyer/seller of that chat (or admin) to read & insert.
CREATE POLICY "chat_images_party_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.order_chats c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  )
);

CREATE POLICY "chat_images_party_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  AND EXISTS (
    SELECT 1 FROM public.order_chats c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
  )
);
