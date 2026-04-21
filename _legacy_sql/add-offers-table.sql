-- Migration: Create property_offers table for buy/sell offers
-- Run this in your Supabase SQL Editor

-- Create property_offers table
CREATE TABLE IF NOT EXISTS property_offers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  buyer_id TEXT NOT NULL, -- Clerk user ID of the buyer
  seller_id TEXT NOT NULL, -- Clerk user ID of the seller (property owner)
  offer_amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  offer_type TEXT NOT NULL CHECK (offer_type IN ('purchase', 'rental')), -- 'purchase' or 'rental'
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'withdrawn', 'completed'
  message TEXT, -- Optional message from buyer
  expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration date
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_property_offers_property_id ON property_offers(property_id);
CREATE INDEX IF NOT EXISTS idx_property_offers_buyer_id ON property_offers(buyer_id);
CREATE INDEX IF NOT EXISTS idx_property_offers_seller_id ON property_offers(seller_id);
CREATE INDEX IF NOT EXISTS idx_property_offers_status ON property_offers(status);
CREATE INDEX IF NOT EXISTS idx_property_offers_created_at ON property_offers(created_at DESC);

-- Enable Row Level Security
ALTER TABLE property_offers ENABLE ROW LEVEL SECURITY;

-- Policy: Buyers can view their own offers
CREATE POLICY "Buyers can view own offers" ON property_offers
  FOR SELECT USING (buyer_id = public.clerk_user_id());

-- Policy: Sellers can view offers for their properties
CREATE POLICY "Sellers can view offers for their properties" ON property_offers
  FOR SELECT USING (seller_id = public.clerk_user_id());

-- Policy: Buyers can create offers
CREATE POLICY "Buyers can create offers" ON property_offers
  FOR INSERT WITH CHECK (
    buyer_id = public.clerk_user_id()
    OR current_setting('request.jwt.claims', true) IS NOT NULL
  );

-- Policy: Sellers can update offer status (accept/reject)
CREATE POLICY "Sellers can update offer status" ON property_offers
  FOR UPDATE USING (seller_id = public.clerk_user_id())
  WITH CHECK (seller_id = public.clerk_user_id());

-- Policy: Buyers can withdraw their own offers
CREATE POLICY "Buyers can withdraw offers" ON property_offers
  FOR UPDATE USING (buyer_id = public.clerk_user_id())
  WITH CHECK (buyer_id = public.clerk_user_id() AND status = 'withdrawn');

-- Add comment
COMMENT ON TABLE property_offers IS 'Property purchase and rental offers from buyers to sellers';

SELECT 'Property offers table created successfully!' as message;
