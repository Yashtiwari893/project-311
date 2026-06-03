import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LinkedFlow India — LinkedIn Automation Platform',
  description: 'India\'s smartest LinkedIn outreach & automation platform for agencies and freelancers. AI-powered, ₹2,999/month.',
  keywords: 'linkedin automation india, linkedin outreach tool, linkedin lead generation india',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script src="https://checkout.razorpay.com/v1/checkout.js" async />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
