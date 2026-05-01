/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as newOrderSeller } from './new-order-seller.tsx'
import { template as newOrderAdmin } from './new-order-admin.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'new-order-seller': newOrderSeller,
  'new-order-admin': newOrderAdmin,
}
