# -*- coding: utf-8 -*-
from weasyprint import HTML

OUT = "/sessions/cool-friendly-cray/mnt/Project Management app/reports"
DATE = "16 July 2026"

CSS = """
@page {
  size: A4; margin: 20mm 18mm 18mm 18mm;
  @bottom-center { content: "Aurora by Nvexis - Confidential"; font-family: Georgia, serif; font-size: 8pt; color: #8a7d6e; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font-family: Georgia, serif; font-size: 8pt; color: #8a7d6e; }
}
@page :first { margin: 0; }
* { box-sizing: border-box; }
body { font-family: Georgia, "Times New Roman", serif; color: #201a16; font-size: 10.5pt; line-height: 1.5; }
h1,h2,h3,h4 { font-family: "Helvetica Neue", Arial, sans-serif; color: #201a16; line-height: 1.15; }
h1 { font-size: 22pt; color: #7A2A26; margin: 0 0 6pt; }
h2 { font-size: 15pt; color: #7A2A26; margin: 20pt 0 7pt; border-bottom: 2px solid #e3d8c6; padding-bottom: 4pt; }
h3 { font-size: 11.5pt; margin: 13pt 0 4pt; color: #2A211C; }
h4 { font-size: 10pt; margin: 9pt 0 2pt; color: #7A2A26; text-transform: uppercase; letter-spacing: .06em; }
p { margin: 0 0 7pt; }
ul,ol { margin: 0 0 8pt; padding-left: 16pt; }
li { margin-bottom: 3pt; }
.accent { color: #7A2A26; }
.small { font-size: 8.6pt; color: #6E6357; }
.mono { font-family: "Courier New", monospace; font-size: 9pt; }
.cover { height: 297mm; padding: 40mm 24mm; background: #ECE4D6; display: flex; flex-direction: column; }
.cover .eyebrow { font-family:"Helvetica Neue",Arial,sans-serif; letter-spacing:.28em; text-transform:uppercase; font-size:9pt; color:#7A2A26; margin-top: 26mm;}
.cover h1 { font-size: 34pt; margin: 8pt 0 10pt; max-width: 15ch; }
.cover .sub { font-size: 13pt; color:#3a2f28; max-width: 44ch; }
.cover .meta { margin-top: auto; font-size: 9.5pt; color:#6E6357; }
.cover .rule { width: 60px; height: 4px; background: linear-gradient(90deg,#7A2A26,#C24A40); margin: 14pt 0; }
.callout { background: #f3ecdd; border-left: 4px solid #7A2A26; padding: 9pt 12pt; margin: 9pt 0; }
.callout.warn { border-left-color:#b5852f; background:#f6efdd; }
.callout.good { border-left-color:#3f6b52; background:#eef2ea; }
table { width: 100%; border-collapse: collapse; margin: 8pt 0 12pt; font-size: 9.4pt; }
th,td { border: 1px solid #d8cbb6; padding: 5pt 7pt; text-align: left; vertical-align: top; }
th { background: #e6dbc8; font-family:"Helvetica Neue",Arial,sans-serif; font-size: 9pt; }
tr:nth-child(even) td { background: #f6f1e6; }
.kpi { display:flex; gap:10pt; margin: 8pt 0; }
.kpi .box { flex:1; border:1px solid #d8cbb6; border-radius:6px; padding:8pt; background:#f6f1e6; }
.kpi .n { font-family:"Helvetica Neue",Arial,sans-serif; font-size:15pt; color:#7A2A26; }
.pagebreak { page-break-before: always; }
.tag { display:inline-block; font-family:"Helvetica Neue",Arial,sans-serif; font-size:7.5pt; letter-spacing:.06em; text-transform:uppercase; padding:2pt 7pt; border-radius:999px; }
.tag.yes { background:#e2eede; color:#2f5a3f; }
.tag.no { background:#f3ddda; color:#7A2A26; }
.tag.maybe { background:#f6ecd6; color:#8a6414; }
"""

MARK = """<svg width="62" height="62" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="104" height="104" rx="26" fill="#7A2A26"/><g fill="#F3ECDD"><polygon points="60,24 62,24 37,96 25,96"/><polygon points="58,24 60,24 101,96 77,96"/><rect x="44" y="66.5" width="29" height="8"/><rect x="18.5" y="91.5" width="27.5" height="6.5" rx="1.5"/><rect x="74" y="91.5" width="30" height="6.5" rx="1.5"/></g></svg>"""

def cover(title, sub, tag):
    return f"""<div class="cover">{MARK}
      <div class="eyebrow">Aurora - by Nvexis - {tag}</div>
      <h1>{title}</h1><div class="rule"></div>
      <div class="sub">{sub}</div>
      <div class="meta">Prepared {DATE} &nbsp;-&nbsp; Confidential strategy document &nbsp;-&nbsp; Aurora is a product of Nvexis</div></div>"""

def render(name, body):
    html = f"<html><head><meta charset='utf-8'><style>{CSS}</style></head><body>{body}</body></html>"
    HTML(string=html).write_pdf(f"{OUT}/{name}")
    print("wrote", name)

r1 = cover("App-Store Publishing, Go-to-Market &amp; Revenue Model",
  "Can Aurora ship to the Play Store and App Store? What it costs, how to market it, and a realistic revenue &amp; expense model for a US-global and India launch.",
  "Strategy Report")
r1 += """<div class="pagebreak"></div>
<h1>Executive summary</h1>
<p>Aurora is an installable Progressive Web App (PWA) - React + Vite, hosted on Cloudflare Pages, with Supabase for data/auth and Dodo Payments (a merchant of record) for billing. It already ships a full web manifest, service worker, and branded icons, so it is <strong>technically ready for app-store packaging today</strong>.</p>
<ul>
<li><span class="tag yes">Google Play - Yes</span> A PWA can go on Google Play via a <strong>Trusted Web Activity (TWA)</strong> using Bubblewrap or PWABuilder. Officially supported, cheap ($25 one-time), low-effort. Aurora qualifies with minor prep.</li>
<li><span class="tag maybe">Apple App Store - Yes, but not as a plain PWA</span> Apple routinely rejects "repackaged website" wrappers under <strong>Guideline 4.2</strong>. To get in you must ship a real native binary (via <strong>Capacitor</strong>) that adds genuine native value (push notifications, share sheet, biometric unlock). Budget more time and a $99/yr account.</li>
<li><strong>Unit economics are healthy:</strong> Pro at $5.99/mo nets roughly <strong>$5.20/mo</strong> after Dodo's ~6-7% merchant-of-record fees. Infrastructure is near-zero until real traction.</li>
<li><strong>Realistic Year-1 outcome</strong> for a well-marketed solo launch: a conservative base case is <strong>$5k-$15k ARR</strong>, with the ceiling set almost entirely by marketing reach, not by cost.</li>
</ul>
<h2>Part A - Can Aurora be published to the app stores?</h2>
<h3>What Aurora is, technically</h3>
<p>Aurora is a client-rendered PWA served over HTTPS from Cloudflare Pages, with an installable manifest and a Workbox service worker. App stores don't host web apps directly - you wrap the PWA in a thin native container and submit that. The two platforms treat this very differently.</p>
<h3>Google Play Store - supported and straightforward <span class="tag yes">Recommended first</span></h3>
<p>Google explicitly supports PWAs on Play through a <strong>Trusted Web Activity (TWA)</strong>: a Chrome-backed, full-screen container that renders your live PWA with no browser chrome. Generate it with <strong>Bubblewrap</strong> (CLI) or <strong>PWABuilder</strong> (GUI).</p>
<h4>Requirements (Aurora already meets most)</h4>
<ul>
<li>HTTPS (Cloudflare) and a valid web manifest with name, icons, <span class="mono">start_url</span>, display, theme/background colors - already in <span class="mono">vite.config.ts</span>.</li>
<li>Lighthouse PWA quality score &#8805; 80 - verify in Chrome DevTools.</li>
<li>Host <span class="mono">/.well-known/assetlinks.json</span> (Digital Asset Links) with your signing key's SHA-256 - served from Cloudflare <span class="mono">public/</span>.</li>
<li>Store assets: &#8805;3 phone + 2 tablet screenshots, a 1024x500 feature graphic, description, privacy policy URL.</li>
</ul>
<h4>Cost &amp; time</h4>
<ul><li>Google Play account: <strong>$25 one-time</strong>.</li><li>Effort: <strong>half-day to a day</strong> with PWABuilder; review 2-7 days.</li></ul>
<div class="callout good"><strong>Verdict:</strong> Do this. Cheapest, fastest real "app in the store," and it reuses your live site - every web deploy updates the Android app instantly.</div>
<h3>Apple App Store - possible, but not as a bare PWA <span class="tag maybe">Plan for native work</span></h3>
<p>Apple's <strong>Guideline 4.2 (Minimum Functionality)</strong> requires an app to "include features, content, and UI that elevate it beyond a repackaged website." A PWA in a WebView (e.g. PWABuilder's iOS output) is exactly what that targets and is <strong>frequently rejected</strong>, each rejection-resubmission cycle costing days to weeks.</p>
<h4>The realistic path in</h4>
<ul>
<li><strong>Wrap with Capacitor</strong> (not a raw WebView). Capacitor loads your web app but adds real native capabilities that satisfy 4.2:</li>
<li>native <strong>push notifications</strong> (a strong 4.2 signal), <strong>share sheet</strong>, <strong>biometric/Face ID unlock</strong>, native file pickers, haptics.</li>
<li>Add one or two genuinely native features + iOS-native splash/icons before first submission.</li>
</ul>
<h4>Cost &amp; time</h4>
<ul><li>Apple Developer Program: <strong>$99/year</strong>; requires a Mac or Mac cloud CI to build.</li><li>Effort: <strong>1-3 weeks</strong> including Capacitor + native features + likely one rejection cycle.</li></ul>
<div class="callout warn"><strong>Recommendation:</strong> Ship Google Play now. Treat iOS as Phase 2 once you have paying users - build a Capacitor shell with push notifications so it clears 4.2 first time. Meanwhile iOS users can "Add to Home Screen" in Safari and use the full PWA.</div>
<h3>Do you even need the stores?</h3>
<p>Both are distribution + trust channels, not requirements - Aurora already installs from the browser on both platforms. Prioritize Play early (cheap) and Apple when the ROI is clear.</p>"""

r1 += """<div class="pagebreak"></div>
<h2>Part B - Product &amp; market analysis</h2>
<h3>Positioning</h3>
<p>Aurora's wedge is <strong>"all-in-one, but calm and cheap."</strong> Most tools force a choice: a board tool (Trello), a doc tool (Notion), a whiteboard (Miro), or a knowledge base (Obsidian). Aurora combines Kanban boards, a Notion-style block editor, an infinite collaborative canvas, calendar, to-dos, folders and reminders in one installable workspace - with a genuinely generous free tier and Pro priced like a coffee ($5.99/mo).</p>
<h3>Target segments</h3>
<ul>
<li><strong>Solo builders &amp; indie founders</strong> - one tool for plan + notes + sketches; price-sensitive; value design and speed.</li>
<li><strong>Small teams (2-10)</strong> - shared boards + docs without paying $10-15/seat.</li>
<li><strong>Students &amp; freelancers</strong> - especially in price-sensitive markets like India; free tier + low Pro price are decisive.</li>
</ul>
<h3>Competitive landscape</h3>
<table>
<tr><th>Competitor</th><th>Typical price</th><th>Aurora's edge</th></tr>
<tr><td>Notion</td><td>~$10/user/mo</td><td>Boards + canvas + reminders built in; cheaper; installable; calmer default UX</td></tr>
<tr><td>Trello</td><td>~$5-10/user/mo</td><td>Notes, canvas &amp; docs beyond cards; unlimited boards on Pro</td></tr>
<tr><td>ClickUp</td><td>~$7-12/user/mo</td><td>Far simpler, less overwhelming; flat low price</td></tr>
<tr><td>Miro</td><td>~$8-16/user/mo</td><td>Canvas is one feature, not a separate paid tool</td></tr>
<tr><td>Obsidian</td><td>Free + paid sync</td><td>Real-time collab + boards + calendar out of the box</td></tr>
</table>
<h3>SWOT</h3>
<table>
<tr><th>Strengths</th><th>Weaknesses</th></tr>
<tr><td>All-in-one; standout design; generous free tier; very low Pro price; PWA (no store gatekeeper); solid security foundation.</td><td>Solo/small team behind it; no brand awareness yet; limited support &amp; roadmap capacity; crowded category.</td></tr>
<tr><th>Opportunities</th><th>Threats</th></tr>
<tr><td>Price-sensitive global &amp; India markets; "calm software" trend; build-in-public audience; app-store ASO; education niche.</td><td>Incumbents bundling features; churn if reliability slips; support load; platform/payment fee changes.</td></tr>
</table>"""

r1 += """<div class="pagebreak"></div>
<h2>Part C - Go-to-market plan</h2>
<h3>Launch channels (highest ROI first for a solo/small team)</h3>
<ul>
<li><strong>Build-in-public on X / LinkedIn</strong> - narrate the journey, show the design. Cheapest durable channel; compounds.</li>
<li><strong>Product Hunt launch</strong> - one big spike; prep an asset kit, a founding-member offer, a hunter; aim Tue-Thu.</li>
<li><strong>Reddit &amp; niche communities</strong> - r/productivity, r/Notion (migration angle), r/SaaS, IndieHackers. Lead with value.</li>
<li><strong>Content/SEO</strong> - "Notion alternative", "free Trello alternative", "all-in-one project app". Compounding.</li>
<li><strong>App-store ASO</strong> - once on Play, optimize title/keywords/screenshots; free discovery.</li>
<li><strong>Education/India</strong> - student communities, regional pricing, campus ambassadors.</li>
</ul>
<h3>Conversion levers already in the product</h3>
<ul>
<li>Generous free tier lowers signup friction; Pro gates the "wow" (canvas + media + reminders) - natural upgrade triggers.</li>
<li>A <strong>founding-member price</strong> (annual, anchored) drives early cash and loyalty.</li>
<li>In-app upgrade prompts at the moment of need (board/member limit; opening the canvas).</li>
</ul>
<h2>Part D - Revenue &amp; expense model</h2>
<p class="small">All figures are planning estimates, not guarantees. Revenue here is dominated by marketing reach and retention, which are hard to predict for a new brand. Ranges are deliberately conservative.</p>
<h3>Unit economics (per Pro subscriber)</h3>
<table>
<tr><th>Item</th><th>Monthly</th><th>Annual plan</th></tr>
<tr><td>List price (USD)</td><td>$5.99</td><td>$68.29 (~$5.69/mo)</td></tr>
<tr><td>Dodo fee (MoR): 4% + $0.40 base, +1.5% intl, +0.5% sub - ~6% + $0.40 blended</td><td>-$0.76</td><td>-$4.50</td></tr>
<tr><td><strong>Net revenue</strong></td><td><strong>~ $5.23/mo</strong></td><td><strong>~ $63.8/yr</strong></td></tr>
<tr><td>Marginal infra cost / user</td><td colspan="2">~ $0 until scale (free tiers); pennies/user thereafter</td></tr>
</table>
<div class="callout">Dodo is a <strong>merchant of record</strong>: it takes on sales-tax/VAT compliance and chargebacks for a higher rate than a bare processor. For a solo operator selling globally, that compliance offload is usually worth ~6-7%.</div>
<h3>Fixed &amp; recurring costs</h3>
<table>
<tr><th>Cost</th><th>Early (pre-traction)</th><th>At ~1,000 active users</th></tr>
<tr><td>Supabase (DB/auth/storage)</td><td>$0 (free)</td><td>$25/mo (Pro)</td></tr>
<tr><td>Cloudflare Pages (hosting)</td><td>$0</td><td>$0</td></tr>
<tr><td>Resend (reminder emails)</td><td>$0 (free 3k/mo)</td><td>$20/mo</td></tr>
<tr><td>Domain</td><td>~$12/yr</td><td>~$12/yr</td></tr>
<tr><td>Google Play (one-time)</td><td>$25</td><td>-</td></tr>
<tr><td>Apple Developer (if iOS)</td><td>$99/yr</td><td>$99/yr</td></tr>
<tr><td>Dodo fees</td><td colspan="2">Variable, ~6-7% of revenue (only when you earn)</td></tr>
<tr><td>One-off pen-test (pre-launch)</td><td colspan="2">$4,000-$8,000 (see companion report)</td></tr>
</table>
<p><strong>Takeaway:</strong> your only material fixed cost before real revenue is the optional pen-test and ~$1-2k/yr of platform floors. This is a near-zero-burn business until it works.</p>
<h3>Scenario model - US / global (USD), 12 months</h3>
<table>
<tr><th>Scenario</th><th>Signups yr1</th><th>Free-&gt;Pro</th><th>Pro subs</th><th>Net MRR</th><th>Net ARR</th><th>Costs/yr</th><th>Profit</th></tr>
<tr><td>Conservative</td><td>1,000</td><td>2%</td><td>20</td><td>~$105</td><td>~$1.3k</td><td>~$0.4k</td><td>~$0.9k</td></tr>
<tr><td>Base</td><td>5,000</td><td>3%</td><td>150</td><td>~$785</td><td>~$9.4k</td><td>~$0.9k</td><td>~$8.5k</td></tr>
<tr><td>Optimistic</td><td>20,000</td><td>4%</td><td>800</td><td>~$4,180</td><td>~$50k</td><td>~$3k</td><td>~$47k</td></tr>
</table>
<p class="small">Assumes ~$5.23 net/Pro/mo, freemium free-&gt;paid of 2-4% (typical SaaS is 2-5%), modest churn. Costs include Supabase/Resend scaling + Apple + support tooling; excludes your time and the one-off pen-test.</p>
<h3>Scenario model - India-first (regional pricing)</h3>
<p>India buyers convert on price. Use Dodo regional pricing to sell Pro at ~<strong>&#8377;199/mo (~$2.30)</strong> or &#8377;1,499/yr. ARPU is ~40% of the USD plan, but the student/indie base is large; expect <strong>lower conversion (1-2%)</strong> and higher volume.</p>
<table>
<tr><th>Scenario</th><th>Signups yr1</th><th>Free-&gt;Pro</th><th>Pro subs</th><th>Net MRR (~)</th><th>Net ARR (~)</th></tr>
<tr><td>Conservative</td><td>3,000</td><td>1%</td><td>30</td><td>~$60</td><td>~$0.7k</td></tr>
<tr><td>Base</td><td>12,000</td><td>1.5%</td><td>180</td><td>~$360</td><td>~$4.3k</td></tr>
<tr><td>Optimistic</td><td>40,000</td><td>2%</td><td>800</td><td>~$1,600</td><td>~$19k</td></tr>
</table>
<p class="small">Net assumes ~$2.00/Pro/mo after fees at &#8377;199. India volume can exceed the US, but revenue/user is lower - the winning play is usually <strong>USD pricing globally + regional (PPP) pricing for India</strong>, which Dodo supports across 220+ countries.</p>
<h3>Honest expectations</h3>
<ul>
<li>Most new indie SaaS never cross $1k MRR - not because of cost, but <strong>distribution</strong>. Your edge is a strong product and near-zero burn, so you can keep iterating cheaply.</li>
<li>Realistic 12-month target for a committed solo launch with consistent marketing is the <strong>Base case (~$5k-$10k ARR)</strong>, with upside if a launch or channel breaks out.</li>
<li>Retention &gt; acquisition: with tiny costs, every retained Pro user is almost pure margin. Invest in reliability, onboarding, and the canvas "wow".</li>
</ul>
<h3>Recommended 90-day plan</h3>
<ol>
<li>Finish security remediation (done) - optional focused pen-test before charging at scale.</li>
<li>Ship to <strong>Google Play via PWABuilder</strong> (half-1 day) and add <span class="mono">assetlinks.json</span>.</li>
<li>Turn on <strong>regional pricing</strong> in Dodo (USD global + INR for India).</li>
<li>Prepare a <strong>Product Hunt</strong> launch + founding-member annual offer; seed Reddit/IndieHackers.</li>
<li>Start build-in-public content; publish 2-3 SEO "alternative to..." pages.</li>
<li>Only after paying-user signal: build the <strong>Capacitor iOS</strong> app with push notifications for the App Store.</li>
</ol>
<h3>Sources</h3>
<p class="small">MobiLoud, "Can You Publish a PWA to the App Store and Google Play? (2026)"; Google for Developers, "Adding your PWA to Google Play"; Android Developers, "Trusted Web Activities"; PWABuilder Blog, "Publish your PWA to the iOS App Store"; Apple App Store Review Guidelines section 4.2; Dodo Payments, "Pricing" and "Cheapest Merchant of Record for SaaS (2026)". Cross-checked July 2026; treat projections as estimates.</p>"""

render("Aurora_Publishing_Marketing_Revenue_Report.pdf", r1)

r2 = cover("Penetration Testing - Options, Pricing &amp; Recommendation",
  "Who can pen-test Aurora before it charges real money, what it should cost in 2026, and the cheapest reputable option for a solo SaaS.",
  "Security Report")
r2 += """<div class="pagebreak"></div>
<h1>Executive summary</h1>
<p>Aurora is a multi-tenant SaaS that will hold user data and take payments, so an independent <strong>web-application + API penetration test</strong> is the right pre-launch check (already a go-live gate). An internal security review has already found and fixed the high-impact issues, so a tester's time can go straight to deeper testing rather than rediscovering known bugs.</p>
<div class="kpi">
  <div class="box"><div class="n">$4k-$8k</div><div class="small">Reputable seed-stage web-app + API pentest (2026)</div></div>
  <div class="box"><div class="n">$1.5k-$3k</div><div class="small">Vetted independent certified tester (budget route)</div></div>
  <div class="box"><div class="n">$0</div><div class="small">Bugs a tester finds free because you fixed the known ones first</div></div>
</div>
<p><strong>Recommendation for Aurora now:</strong> a <strong>focused, fixed-scope web-app + API test in the $4,000-$8,000 band</strong> from a startup-focused boutique or a vetted independent OSCP/OSWE tester, with a free retest of fixes included. If cash is tight pre-revenue, a carefully vetted independent at $1,500-$3,000 is a legitimate cheaper option - provided you check certifications, a sample report, and that a retest is included.</p>
<h2>What kind of test Aurora needs</h2>
<p>Not a full red-team or network engagement. Aurora needs a <strong>gray-box web-application &amp; API assessment</strong> focused on multi-tenant SaaS risks:</p>
<ul>
<li><strong>Multi-tenant isolation / IDOR</strong> - the single most important area. With two+ tenant accounts, attempt cross-tenant read/write on every table and every <span class="mono">/rpc/</span> function (the internal review flagged the RPC surface specifically).</li>
<li><strong>Authentication &amp; session</strong> - Supabase Auth flows, JWT handling, password reset, OAuth.</li>
<li><strong>RLS &amp; privilege escalation</strong> - can a user change their own plan, read others' billing data, or forge notifications? (All hardened in the recent remediation.)</li>
<li><strong>Payment/webhook integrity</strong> - Dodo webhook signature, idempotency, entitlement path.</li>
<li><strong>Standard web classes</strong> - XSS/CSP, SSRF, injection, file-upload/storage abuse, rate limiting.</li>
</ul>
<p>Scope: roughly <strong>one web app + its API/RPC surface, two user roles, a seeded staging environment</strong> - typically 5-8 tester-days plus reporting.</p>
<h2>2026 pricing landscape</h2>
<table>
<tr><th>Option</th><th>Typical price</th><th>Best for</th><th>Notes</th></tr>
<tr><td>Vetted independent tester (OSCP/OSWE) via Upwork/Toptal/referral</td><td>$1,500-$3,500</td><td>Pre-revenue solo</td><td>Cheapest reputable; quality varies - vet hard.</td></tr>
<tr><td>Startup-focused boutique / PTaaS</td><td>$4,000-$8,000</td><td>Seed-stage SaaS</td><td>Fixed scope: 1 app, 1-2 roles, few endpoints; 5-7 days + report. Best value/credibility balance.</td></tr>
<tr><td>Crowdsourced (Intigriti / HackerOne / Bugcrowd)</td><td>Variable / bounty</td><td>Ongoing coverage</td><td>Great continuous testing, but not a point-in-time report an enterprise buyer wants.</td></tr>
<tr><td>Established firm (compliance-grade, SOC 2)</td><td>$15,000-$35,000+</td><td>Series A+ / enterprise</td><td>Overkill now; revisit when a customer requires it.</td></tr>
<tr><td>Full red-team engagement</td><td>$50,000-$100,000+</td><td>Mature programs</td><td>Not relevant at this stage.</td></tr>
</table>
<p class="small">Sources: Autonoma, SecureLeap, RedFox, BlazeInfoSec, BrightDefense, BSG, Synack, Invicti - 2026 pentest pricing guides. Common caveat: final invoices often land 40-60% above the initial quote once retests and out-of-scope findings are added.</p>
<h2>Cheapest reputable option - and how to vet it</h2>
<p>Best value for Aurora today is a <strong>startup-focused boutique or a single strong independent certified tester</strong> at the low end ($1.5k-$4k). "Cheap" only counts if it's real testing, so require:</p>
<ul>
<li><strong>Certifications:</strong> OSCP minimum; OSWE (web) a strong plus.</li>
<li><strong>A sanitized sample report:</strong> clear repro steps, risk ratings, remediation - not an automated-scanner dump.</li>
<li><strong>Methodology:</strong> OWASP Web Security Testing Guide / OWASP Top 10 and PTES.</li>
<li><strong>A free retest</strong> of fixes included.</li>
<li><strong>Manual testing</strong>, not scanner-only - tools miss the IDOR/business-logic flaws that are Aurora's main risk.</li>
<li><strong>References</strong> from other small SaaS clients.</li>
</ul>
<div class="callout warn">Avoid the "$300 automated scan" listings - those run a tool you could run yourself and won't find the multi-tenant logic flaws that actually threaten a SaaS.</div>
<h2>How to cut the cost (do this first)</h2>
<ul>
<li><strong>Fix known findings first</strong> - done. Don't pay an expert to rediscover patched bugs.</li>
<li><strong>Provide a seeded staging environment</strong> with two+ tenants, sample data, one Pro + one Free account.</li>
<li><strong>Hand over docs</strong> - data model, RLS/security notes, RPC endpoint list. Gray-box is faster/cheaper than black-box.</li>
<li><strong>Tightly scope</strong> - one app, its API/RPC, two roles. Resist infra/network creep.</li>
</ul>
<h2>Recommendation for Aurora</h2>
<ol>
<li><strong>Now (pre-charging at scale):</strong> commission a <strong>focused web-app + API pentest, $4,000-$8,000</strong>, from a startup-focused boutique with a retest included. If pre-revenue and cash-constrained, a vetted independent OSCP/OSWE tester at <strong>$1,500-$3,000</strong> is an acceptable first pass.</li>
<li>Give them a seeded two-tenant staging site + security docs to minimize hours.</li>
<li>Remediate findings, take the free retest, then flip Dodo to live and open paid signups.</li>
<li><strong>Later (enterprise / SOC 2):</strong> move to an established firm only when a customer requires a named-firm report.</li>
<li><strong>Optionally ongoing:</strong> a crowdsourced program for continuous coverage between annual tests.</li>
</ol>
<h3>Sources</h3>
<p class="small">Autonoma, SecureLeap, RedFox Security, Blaze Information Security, Bright Defense, BSG, Synack, Invicti - "Penetration Testing Cost 2026" guides; OWASP Web Security Testing Guide; PTES. Prices are 2026 market ranges and vary by scope, region and vendor; get 2-3 quotes.</p>"""

render("Aurora_Penetration_Test_Options_Report.pdf", r2)
print("done")
