import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Camera, User as UserIcon, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Profile = {
  id: string;
  display_name: string | null;
  whatsapp_number: string | null;
  avatar_url: string | null;
  email: string | null;
};

export const ProfileCard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, whatsapp_number, avatar_url, email")
      .eq("id", user!.id)
      .maybeSingle();
    if (error) toast.error(error.message);
    if (data) {
      setProfile(data as Profile);
      setDisplayName(data.display_name ?? "");
      setWhatsapp(data.whatsapp_number ?? "");
    }
    setLoading(false);
  };

  const save = async () => {
    const name = displayName.trim();
    const wa = whatsapp.trim();
    if (name.length > 60) return toast.error("Name must be under 60 characters");
    if (wa && !/^[+]?[0-9\s-]{7,20}$/.test(wa)) return toast.error("Invalid WhatsApp number");
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name || null, whatsapp_number: wa || null })
      .eq("id", user!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    load();
  };

  const onPickAvatar = () => fileRef.current?.click();

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast.error("Image too large (max 3MB)");
    if (!file.type.startsWith("image/")) return toast.error("Please pick an image");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user!.id}/avatar-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user!.id);
      if (error) throw error;
      toast.success("Profile photo updated");
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAvatar = async () => {
    setUploading(true);
    const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user!.id);
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Photo removed");
    load();
  };

  const deleteAccount = async () => {
    if (confirmText !== "DELETE") return toast.error('Type "DELETE" to confirm');
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Account deleted");
      await signOut();
      navigate("/");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  const initials = (displayName || user?.email || "U").slice(0, 2).toUpperCase();

  return (
    <Card id="profile" className="p-6 scroll-mt-24">
      <h2 className="font-semibold mb-1 flex items-center gap-2">
        <UserIcon className="h-4 w-4 text-primary" /> Profile & Customization
      </h2>
      <p className="text-sm text-muted-foreground mb-5">
        Update your photo, name, and WhatsApp number.
      </p>

      {loading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-border">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="Profile photo" />}
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={uploadAvatar}
              />
              <Button size="sm" variant="outline" onClick={onPickAvatar} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Camera className="h-4 w-4 mr-1.5" />}
                {profile?.avatar_url ? "Change photo" : "Upload photo"}
              </Button>
              {profile?.avatar_url && (
                <Button size="sm" variant="ghost" onClick={removeAvatar} disabled={uploading}>
                  Remove
                </Button>
              )}
            </div>
          </div>

          {/* Fields */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="dn">Display name</Label>
              <Input
                id="dn"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                maxLength={60}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="wa">WhatsApp number</Label>
              <Input
                id="wa"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+91 98xxxxxxxx"
                maxLength={20}
                className="mt-1.5"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Email</Label>
              <Input value={profile?.email ?? user?.email ?? ""} disabled className="mt-1.5" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save changes
            </Button>

            <AlertDialog onOpenChange={(o) => !o && setConfirmText("")}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your account and profile. Wallet balance, orders,
                    and listings linked to your account will no longer be accessible. This action
                    cannot be undone.
                    <br /><br />
                    Type <span className="font-mono font-bold">DELETE</span> to confirm.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="mt-2"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); deleteAccount(); }}
                    disabled={deleting || confirmText !== "DELETE"}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
                    Permanently delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </Card>
  );
};
