import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'StreamCart'
const SITE_URL = 'https://streamcart.store'

interface Props {
  sellerName?: string
  productName?: string
  orderId?: string
  amount?: string | number
  earning?: string | number
  buyerEmail?: string
}

const NewOrderSellerEmail = ({
  sellerName,
  productName = 'your product',
  orderId,
  amount,
  earning,
  buyerEmail,
}: Props) => {
  const dashboardUrl = `${SITE_URL}/seller`
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>New order received on {SITE_NAME} 💰</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={brand}>{SITE_NAME}</Heading>
          </Section>

          <Section style={card}>
            <Heading style={h1}>New order received 💰</Heading>
            <Text style={text}>
              {sellerName ? `Hi ${sellerName},` : 'Hi,'} a buyer just placed an
              order for <strong>{productName}</strong>. Please deliver access
              promptly to keep your rating high.
            </Text>

            <Section style={detailsBox}>
              {orderId && <Text style={detailRow}><span style={label}>Order ID:</span> {orderId.slice(0, 8)}</Text>}
              {amount !== undefined && <Text style={detailRow}><span style={label}>Order amount:</span> ₹{amount}</Text>}
              {earning !== undefined && <Text style={detailRow}><span style={label}>Your earning:</span> ₹{earning}</Text>}
              {buyerEmail && <Text style={detailRow}><span style={label}>Buyer:</span> {buyerEmail}</Text>}
            </Section>

            <Button href={dashboardUrl} style={button}>View order</Button>

            <Hr style={hr} />
            <Text style={footer}>
              Tip: Faster delivery = better ratings & more orders.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: NewOrderSellerEmail,
  subject: 'New order received 💰',
  displayName: 'New order — seller',
  previewData: {
    sellerName: 'Rahul',
    productName: 'Netflix Premium 1 Month',
    orderId: 'a1b2c3d4-xxxx',
    amount: '299',
    earning: '270',
    buyerEmail: 'buyer@example.com',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: 0 }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }
const header = { padding: '8px 0 16px' }
const brand = { fontSize: '20px', fontWeight: 700, color: '#16a34a', margin: 0, letterSpacing: '-0.01em' }
const card = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '28px' }
const h1 = { fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 12px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.65', margin: '0 0 20px' }
const detailsBox = { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px 16px', margin: '0 0 24px' }
const detailRow = { fontSize: '13px', color: '#0f172a', margin: '4px 0' }
const label = { color: '#64748b', display: 'inline-block', minWidth: '110px' }
const button = { background: '#16a34a', color: '#ffffff', textDecoration: 'none', padding: '12px 22px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, display: 'inline-block' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0 16px' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: 0 }
