/**
 * Detecting what a business already uses to answer messages.
 *
 * The naive read of this market is "no chat widget means a lead". That gets it
 * backwards. In dental and med spa especially, the businesses with no widget
 * are frequently the ones with no budget and nobody to staff an inbox, while
 * the ones already paying Podium or Weave three to six hundred a month have
 * proven the budget, done the procurement, and are a switching conversation
 * rather than a cold one. So this module does not answer yes or no. It answers
 * which vendor, in which tier, and the pitch changes per tier.
 *
 * Detection reads the homepage HTML only. That is one request per prospect and
 * it misses a widget injected later by a tag manager, so a negative result is
 * recorded as `uncertain` rather than as proof of absence.
 */

/**
 * Vendor signatures.
 *
 * `match` entries are lowercase substrings checked against the homepage HTML.
 * They are script hosts and init globals rather than brand names, because the
 * word "podium" appears in plenty of copy that has nothing to do with the
 * vendor.
 */
export const VENDORS = [
  // Full messaging suites. A business here already pays for this category.
  { id: 'podium', label: 'Podium', tier: 'inbox_platform', match: ['podium.com/widget', 'assets.podium.com', 'connect.podium.com', 'podium-websdk'] },
  { id: 'birdeye', label: 'Birdeye', tier: 'inbox_platform', match: ['birdeye.com/widget', 'cdn.birdeye.com', 'birdeye-webchat'] },
  { id: 'weave', label: 'Weave', tier: 'inbox_platform', match: ['getweave.com', 'weavechat', 'weaveconnect'] },
  { id: 'solutionreach', label: 'Solutionreach', tier: 'inbox_platform', match: ['solutionreach.com', 'sr-chat'] },
  { id: 'revenuewell', label: 'RevenueWell', tier: 'inbox_platform', match: ['revenuewell.com'] },
  { id: 'doctible', label: 'Doctible', tier: 'inbox_platform', match: ['doctible.com'] },
  { id: 'swell', label: 'Swell', tier: 'inbox_platform', match: ['swellcx.com'] },
  { id: 'nexhealth', label: 'NexHealth', tier: 'inbox_platform', match: ['nexhealth.com'] },
  { id: 'intercom', label: 'Intercom', tier: 'inbox_platform', match: ['widget.intercom.io', 'intercomsettings', 'intercomcdn.com'] },
  { id: 'zendesk', label: 'Zendesk', tier: 'inbox_platform', match: ['static.zdassets.com', 'zendesk.com/embeddable', 'zesettings'] },
  { id: 'gorgias', label: 'Gorgias', tier: 'inbox_platform', match: ['config.gorgias.chat', 'gorgias.chat'] },
  { id: 'front', label: 'Front', tier: 'inbox_platform', match: ['chat.frontapp.com'] },
  { id: 'hubspot', label: 'HubSpot', tier: 'inbox_platform', match: ['js.hs-scripts.com', 'js.hsforms.net', 'hs-banner.com'] },
  { id: 'freshchat', label: 'Freshchat', tier: 'inbox_platform', match: ['wchat.freshchat.com', 'fw-cdn.com'] },
  { id: 'gubagoo', label: 'Gubagoo', tier: 'inbox_platform', match: ['gubagoo.io', 'gubagoo.com'] },
  { id: 'activengage', label: 'ActivEngage', tier: 'inbox_platform', match: ['activengage.com'] },
  { id: 'carnow', label: 'CarNow', tier: 'inbox_platform', match: ['carnow.com'] },
  { id: 'liveperson', label: 'LivePerson', tier: 'inbox_platform', match: ['liveperson.net', 'lpsnmedia.net'] },
  { id: 'boulevard', label: 'Boulevard', tier: 'inbox_platform', match: ['blvd.co', 'joinblvd.com'] },
  { id: 'zenoti', label: 'Zenoti', tier: 'inbox_platform', match: ['zenoti.com'] },
  { id: 'mangomint', label: 'Mangomint', tier: 'inbox_platform', match: ['mangomint.com'] },

  // Generic live chat. Cheap or free, single channel, usually unstaffed.
  { id: 'tawk', label: 'Tawk.to', tier: 'chat_widget', match: ['embed.tawk.to'] },
  { id: 'crisp', label: 'Crisp', tier: 'chat_widget', match: ['client.crisp.chat'] },
  { id: 'tidio', label: 'Tidio', tier: 'chat_widget', match: ['code.tidio.co'] },
  { id: 'livechat', label: 'LiveChat', tier: 'chat_widget', match: ['cdn.livechatinc.com'] },
  { id: 'olark', label: 'Olark', tier: 'chat_widget', match: ['static.olark.com'] },
  { id: 'drift', label: 'Drift', tier: 'chat_widget', match: ['js.driftt.com', 'driftt.com'] },
  { id: 'smartsupp', label: 'Smartsupp', tier: 'chat_widget', match: ['smartsuppchat.com'] },
  { id: 'jivochat', label: 'JivoChat', tier: 'chat_widget', match: ['code.jivosite.com'] },
  { id: 'chaport', label: 'Chaport', tier: 'chat_widget', match: ['app.chaport.com'] },

  // A link out to a personal inbox on somebody's phone. This is the fragmented
  // state the pitch describes, and it is the strongest signal on the page.
  { id: 'whatsapp-link', label: 'WhatsApp link', tier: 'social_click', match: ['wa.me/', 'api.whatsapp.com/send', 'web.whatsapp.com/send'] },
  { id: 'messenger-plugin', label: 'Messenger plugin', tier: 'social_click', match: ['fb-customerchat', 'fb-customer-chat', 'm.me/'] },
  { id: 'instagram-dm', label: 'Instagram DM link', tier: 'social_click', match: ['ig.me/m/', 'instagram.com/direct'] },
  { id: 'sms-link', label: 'SMS link', tier: 'social_click', match: ['href="sms:', "href='sms:"] },

  // Already solved, with our own product. Never pitch these.
  { id: 'chatwoot', label: 'Chatwoot', tier: 'chatwoot', match: ['chatwoot', 'sdk.chatwoot'] },
]

/**
 * Codes that mean the site refused the check rather than that it has nothing.
 * Plenty of real small business sites sit behind a WAF that turns away an
 * unfamiliar user agent, and scoring those as greenfield would fill the top of
 * the list with businesses whose vendor was never actually looked at.
 */
const BLOCKED_CODES = new Set([401, 403, 405, 429])

export const TIERS = {
  INBOX_PLATFORM: 'inbox_platform',
  CHAT_WIDGET: 'chat_widget',
  SOCIAL_CLICK: 'social_click',
  CHATWOOT: 'chatwoot',
  NONE: 'none',
}

/** Tiers ranked by how much they say about budget, strongest first. */
const TIER_RANK = [TIERS.CHATWOOT, TIERS.INBOX_PLATFORM, TIERS.CHAT_WIDGET, TIERS.SOCIAL_CLICK]

export function detectVendors(html) {
  if (!html) return []
  const haystack = html.toLowerCase()
  return VENDORS.filter((vendor) => vendor.match.some((needle) => haystack.includes(needle))).map(
    ({ id, label, tier }) => ({ id, label, tier })
  )
}

/** The tier a prospect lands in, which is the tier of its strongest vendor. */
export function primaryTier(vendors) {
  for (const tier of TIER_RANK) {
    if (vendors.some((vendor) => vendor.tier === tier)) return tier
  }
  return TIERS.NONE
}

/**
 * Fetches a homepage and reports what answers messages on it.
 *
 * Only the first chunk of HTML is examined. Widget loaders sit in the head or
 * just before the closing body tag of a page that is otherwise mostly content,
 * and reading a few hundred kilobytes of every prospect's markup to find a
 * script tag is wasted bandwidth on a sweep of hundreds.
 */
export async function inspectSite(
  url,
  { fetchImpl = fetch, timeoutMs = 10000, maxBytes = 600000 } = {}
) {
  if (!url) {
    return {
      url: null,
      reachable: false,
      blocked: false,
      vendors: [],
      tier: TIERS.NONE,
      uncertain: true,
      reason: 'no website listed',
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'htpfinder/0.1 (prospect research; contact info@htpdevs.tech)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })

    if (!response.ok) {
      const blocked = BLOCKED_CODES.has(response.status)
      return {
        url,
        reachable: false,
        blocked,
        vendors: [],
        tier: TIERS.NONE,
        uncertain: true,
        reason: blocked
          ? `homepage is up but refused the check (${response.status}), vendor unknown`
          : `homepage returned ${response.status}`,
      }
    }

    const html = (await response.text()).slice(0, maxBytes)
    const vendors = detectVendors(html)
    const tier = primaryTier(vendors)
    return {
      url: response.url || url,
      reachable: true,
      blocked: false,
      vendors,
      tier,
      // A tag manager can inject a widget after load, which this never sees.
      uncertain: tier === TIERS.NONE,
      reason:
        tier === TIERS.NONE
          ? 'no messaging vendor in the homepage HTML'
          : `${vendors.map((v) => v.label).join(', ')} on the homepage`,
    }
  } catch (err) {
    const aborted = err?.name === 'AbortError'
    return {
      url,
      reachable: false,
      blocked: false,
      vendors: [],
      tier: TIERS.NONE,
      uncertain: true,
      reason: aborted ? 'homepage timed out' : `homepage did not load (${err?.code || err?.message || 'error'})`,
    }
  } finally {
    clearTimeout(timer)
  }
}
