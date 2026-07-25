'use client';

const ITEMS = [
  { icon: 'ri-truck-line', title: 'Reliable delivery', text: 'Shipping options at checkout' },
  { icon: 'ri-lock-2-line', title: 'Secure checkout', text: 'Mobile Money & card' },
  { icon: 'ri-shirt-line', title: 'Quality tees', text: 'Graphic, plain, polo & more' },
  { icon: 'ri-whatsapp-line', title: 'Quick support', text: 'WhatsApp & email' },
] as const;

export default function HomeTrustBar() {
  return (
    <section className="bg-white border-b border-gray-100" aria-label="Store benefits">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-7 md:py-8">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-center lg:justify-between gap-6 sm:gap-x-10 sm:gap-y-5 lg:gap-8">
          {ITEMS.map((item) => (
            <div
              key={item.title}
              className="flex items-center gap-3.5 sm:min-w-[200px] lg:min-w-0 lg:flex-1 lg:justify-center"
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-store-navy"
                aria-hidden
              >
                <i className={`${item.icon} text-lg`} />
              </span>
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
                  {item.title}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
