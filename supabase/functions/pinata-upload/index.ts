const PINATA_JWT = Deno.env.get('PINATA_JWT')
const PINATA_GATEWAY = Deno.env.get('PINATA_GATEWAY') || 'gateway.pinata.cloud'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405)
  }

  if (!PINATA_JWT) {
    return json({ success: false, error: 'PINATA_JWT secret is not configured' }, 500)
  }

  try {
    const { kind = 'json', payload, options = {} } = await req.json()

    if (kind !== 'json') {
      return json({ success: false, error: `Unsupported upload kind: ${kind}` }, 400)
    }

    if (!payload || typeof payload !== 'object') {
      return json({ success: false, error: 'Missing JSON payload' }, 400)
    }

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PINATA_JWT}`,
      },
      body: JSON.stringify({
        pinataContent: payload,
        pinataMetadata: {
          name: options.name || 'metadata.json',
          keyvalues: options.keyvalues || {},
        },
      }),
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      return json(
        {
          success: false,
          error: result?.error?.details || result?.error || `Pinata request failed with ${response.status}`,
        },
        response.status
      )
    }

    const cid = result.IpfsHash || result.cid

    return json({
      success: true,
      cid,
      ipfsUrl: cid ? `ipfs://${cid}` : null,
      gatewayUrl: cid ? `https://${PINATA_GATEWAY}/ipfs/${cid}` : null,
    })
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})
