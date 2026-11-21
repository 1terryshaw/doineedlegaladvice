// Offline rendering checks: real listing template/components, synthetic data reads only.
// Run: node --import tsx --test tests/listing-detail.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const fs = require('node:fs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
global.React = React;

let listing;
let photos;
let logo;
let leads;
let authenticated = true;
const queries = [];
const originalLoad = Module._load;
const link = ({ href, children, prefetch, ...props }) => React.createElement('a', { href, ...props }, children);
const mocks = {
  'next/link': { __esModule: true, default: link },
  'next/navigation': { usePathname: () => '/directory/fixture', useRouter: () => ({}), notFound: () => { throw new Error('NOT_FOUND'); } },
  '@/lib/supabase': { getListing: async slug => { queries.push(['listing', slug]); return listing; } },
  '@/lib/listing-photos': { listPhotosForListing: async id => { queries.push(['photos', id]); return { photos, logo }; } },
  '@/lib/knowledge': { getEnrichment: async (...args) => { queries.push(['enrichment', ...args]); return null; } },
  '@/lib/leads-plus-server': { getLeadsPlusPublicCached: async slug => { queries.push(['leads', slug]); return leads; } },
  '@/lib/useOwnerAuth': { useOwnerAuth: () => ({ authenticated, slug: 'fixture', loading: false }) },
  '@/components/UpgradeModal': { __esModule: true, default: () => null },
  '@/components/ReviewShowcase': { __esModule: true, default: () => React.createElement('div', { 'data-testid': 'reviews' }) },
};
Module._load = function(request, parent, isMain) {
  return Object.hasOwn(mocks, request) ? mocks[request] : originalLoad.call(this, request, parent, isMain);
};
const page = require('../app/directory/[slug]/page.tsx');
const Gallery = require('../components/ListingGallery.tsx').default;
const Image = require('../components/ListingImage.tsx').default;
const { listingPhotoUrl } = require('../lib/listing-photo-url.ts');
const Header = require('../components/Header.tsx').default;
const Pricing = require('../components/PricingTable.tsx').default;
Module._load = originalLoad;

function fixture(overrides = {}) {
  listing = {
    id: 'fixture-id', slug: 'fixture', name: 'Fixture Legal Office', city: 'Austin', province_state: 'TX', country: 'US',
    description: 'First line\nSecond line', short_description: 'Fixture description', claimed: false,
    tier: 'seed', subscription_tier: 'seed', google_rating: 4.86, google_review_count: 12,
    phone: '+1 (226) 260-3573', website: 'example.invalid', email: 'private@example.invalid', email_source: 'fl_bar_registry',
    address: 'PRIVATE STREET', postal_code: 'PRIVATE POSTAL', show_address: false,
    hours_json: { mon: { open: '09:00', close: '17:00' } }, services: ['Consultations'], service_area: ['Austin'],
    year_established: 2011, employee_count: 2, payment_methods: 'Card',
    ...overrides,
  };
  photos = [
    { id: 'bad', public_url: 'gphoto:places/x/photos/y' },
    { id: 'hero', public_url: ' /fixtures/hero.jpg ' },
    { id: 'gallery', public_url: 'https://example.invalid/photo.jpg' },
    { id: 'empty', public_url: '' },
  ];
  logo = { id: 'logo', public_url: '/fixtures/logo.jpg' };
  leads = null;
  queries.length = 0;
}
async function render() {
  return renderToStaticMarkup(await page.default({ params: Promise.resolve({ slug: 'fixture' }) }));
}
function claimLinks(html) { return [...html.matchAll(/<a\b[^>]*href="\/claim(?:[/?#][^"]*)?"[^>]*>/g)].map(m => m[0]); }

test('safe image URLs reject unresolved, malformed and non-web sources; allowed paths are trimmed', () => {
  for (const value of [null, undefined, '', ' ', 'gphoto:x', 'data:image/png;base64,x', 'javascript:alert(1)', '//host/photo', '/\\host/photo', 'https://', 'https://[broken', 'https://host/\nphoto']) {
    assert.equal(listingPhotoUrl(value), null, String(value));
  }
  for (const value of ['/photos/image.jpg', 'http://example.invalid/p.jpg', 'https://example.invalid/p.jpg']) {
    assert.equal(listingPhotoUrl(` ${value} `), value);
  }
});

test('unclaimed listing renders responsive owner card, safe images, phone and unchanged legal content/schema', async () => {
  fixture();
  const html = await render();
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.equal((html.match(/data-testid="owner-claim-card"/g) || []).length, 2);
  assert.match(html, /mb-6 lg:hidden/);
  assert.match(html, /hidden lg:block lg:col-span-1/);
  assert.match(html, /sticky top-24/);
  assert.equal((html.match(/Reviews Not Yet Verified/g) || []).length, 2);
  assert.equal((html.match(/Earn your <strong>Reviews Verified<\/strong> badge/g) || []).length, 2);
  assert.equal((html.match(/Add your own business photos/g) || []).length, 2);
  assert.equal((html.match(/Update phone, hours &amp; services anytime/g) || []).length, 2);
  assert.equal(claimLinks(html).length, 2);
  for (const anchor of claimLinks(html)) assert.match(anchor, /rel="nofollow"/);
  assert.ok(!html.includes('Is this your business?'));
  assert.ok(!html.includes('Claim it free to unlock'));
  assert.match(html, /<details[^>]*><summary[^>]*>Confirm your Google profile/);
  const ids = [...html.matchAll(/\bid="(gbp-[^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  assert.match(html, /Austin, TX/);
  assert.match(html, /4\.9 \(12 reviews\)/);
  assert.match(html, /href="tel:\+12262603573"[^>]*>Call \+1 \(226\) 260-3573/);
  assert.match(html, /href="https:\/\/example.invalid"/);
  assert.match(html, /src="\/fixtures\/hero.jpg"/);
  assert.match(html, /src="\/fixtures\/logo.jpg"/);
  assert.ok(!html.includes('src="gphoto:'));
  assert.ok(!html.includes('PRIVATE STREET'));
  assert.ok(!html.includes('PRIVATE POSTAL'));
  assert.ok(!html.includes('private@example.invalid'));
  assert.match(html, /attorney-client relationship/);
  assert.match(html, /Consult a licensed attorney in your jurisdiction/);
  assert.ok(html.indexOf("We don&#x27;t vet or endorse listed businesses.") > html.indexOf('Frequently Asked'));
  assert.match(html, /Established 2011/);
  assert.match(html, /2 employees/);
  assert.match(html, /Payment methods: Card/);
  assert.match(html, /whitespace-pre-line/);
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  assert.ok(schemas.some(s => s['@type'] === 'LegalService' && s.address.addressLocality === 'Austin' && !s.address.streetAddress));
  assert.ok(schemas.some(s => s['@type'] === 'BreadcrumbList'));
  assert.ok(schemas.some(s => s['@type'] === 'FAQPage'));
  assert.deepEqual(queries, [['listing', 'fixture'], ['enrichment', 'lawyer', 'fixture'], ['photos', 'fixture-id'], ['leads', 'fixture']]);
});

test('all-invalid image slots render no image, gallery heading or gallery wrapper', async () => {
  fixture({ hero_image_url: 'gphoto:unresolved' });
  photos = [{ id: 'bad', public_url: 'data:image/png;base64,x' }];
  logo = { id: 'logo', public_url: '//example.invalid/logo.jpg' };
  const html = await render();
  assert.ok(!/<img\b/.test(html));
  assert.ok(!html.includes('>Photos</h3>'));
  assert.equal(renderToStaticMarkup(React.createElement(Gallery, { photos, showHeading: true })), '');
  assert.equal(renderToStaticMarkup(React.createElement(Image, { src: 'gphoto:x', alt: '', className: '', wrapperClassName: 'gap' })), '');
});

test('rating pill requires positive rating and count', async () => {
  for (const [rating, count] of [[null, null], [0, 12], [4.8, 0], [-1, 12]]) {
    fixture({ google_rating: rating, google_review_count: count });
    const html = await render();
    assert.ok(!html.includes('rounded-full bg-amber-50'));
    assert.ok(!html.includes('0</span>'));
  }
});

test('claimed listings keep owner editing, reviews, public address and owner-provided email', async () => {
  fixture({ claimed: true, tier: 'reviews_plus', subscription_tier: 'reviews_plus', google_place_id: 'fixture-place', show_address: true, email_source: 'owner' });
  const html = await render();
  assert.ok(!html.includes('owner-claim-card'));
  assert.ok(!html.includes('Confirm your Google profile'));
  assert.match(html, /Edit My Listing/);
  assert.match(html, /data-testid="reviews"/);
  assert.match(html, /PRIVATE STREET/);
  assert.match(html, /PRIVATE POSTAL/);
  assert.match(html, /private@example.invalid/);
});

test('Leads Plus keeps its inquiry form, approved content and service/FAQ structured data', async () => {
  fixture({ claimed: true, tier: 'reviews_plus' });
  leads = { gate: { ok: true }, mode: 'A', websiteOk: true, publicEmail: null, whatsapp: null, services: ['Consultations'], kit: { description: 'Owner-approved description', services: ['Consultations'], faqs: [{ q: 'Owner question?', a: 'Owner answer.' }] } };
  const html = await render();
  assert.ok(!html.includes('owner-claim-card'));
  assert.match(html, /leads-plus-mobile-cta/);
  assert.match(html, /leads-plus-sidebar/);
  assert.match(html, /<form/);
  assert.match(html, /Owner-approved description/);
  assert.match(html, /"@type":"Service"/);
  assert.match(html, /Owner question\?/);
});

test('all header and pricing claim links remain nofollow, including query-string links', () => {
  authenticated = false;
  const html = renderToStaticMarkup(React.createElement(Header)) + renderToStaticMarkup(React.createElement(Pricing));
  assert.ok(claimLinks(html).length > 2);
  for (const anchor of claimLinks(html)) assert.match(anchor, /rel="nofollow"/);
});

test('listing template keeps dynamic reads and does not introduce visitor state or cache directives', () => {
  const src = fs.readFileSync('app/directory/[slug]/page.tsx', 'utf8');
  assert.ok(!/export\s+(?:const|function)\s+(?:dynamic|revalidate|dynamicParams|generateStaticParams|fetchCache)\b/.test(src));
  assert.ok(!/\b(?:cookies|headers|unstable_cache|revalidateTag|revalidatePath)\s*\(/.test(src));
  assert.ok(!/\bsearchParams\b/.test(src));
  assert.match(src, /import \{ getListing \} from "@\/lib\/supabase"/);
  assert.ok(!src.includes('ClaimUnlockPreview'));
});
