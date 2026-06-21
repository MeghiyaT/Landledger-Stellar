import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function remint() {
  const properties = [
    { id: "a4131ff7-9c90-4df2-ace5-e93b61b9f740", owner: "user_3CqVcC5bIaESJrLMM9KzGkWPt82", title: "2 BHK in Mumbai", blockchain_property_id: "13" },
    { id: "9a3d10ec-306b-4422-8129-837717872756", owner: "user_3CqVcC5bIaESJrLMM9KzGkWPt82", title: "1 BHK in Pune", blockchain_property_id: "12" }
  ]

  for (const p of properties) {
    console.log(`Reminting ${p.title} (${p.id})...`)
    const tokenUri = `https://landledger.example.com/api/metadata/${p.id}`

    // Fetch the user's public key
    const { data: profile } = await supabase.from('profiles').select('wallet_address').eq('id', p.owner).single()
    if (!profile || !profile.wallet_address) {
      console.error(`No wallet_address for user ${p.owner}`)
      continue
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/mint-property-nft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        ownerAddress: profile.wallet_address,
        propertyId: p.blockchain_property_id,
        tokenUri: tokenUri
      })
    })

    const payload = await res.json()
    console.log(payload)
    if (payload.success) {
      await supabase.from('properties').update({
        nft_token_id: payload.tokenId,
        nft_mint_tx_hash: payload.txHash
      }).eq('id', p.id)
      console.log(`Updated property ${p.id} with token ${payload.tokenId}`)
    }
  }
}
remint()
