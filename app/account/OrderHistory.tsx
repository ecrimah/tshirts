'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useCart } from '@/context/CartContext';

interface OrderItem {
  id: string;
  productId: string | null;
  name: string;
  image: string;
  quantity: number;
  price: number;
  variant?: string | null;
  slug?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  email: string;
  date: string;
  status: string;
  total: number;
  items: OrderItem[];
}

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const { addToCart, setIsCartOpen } = useCart();
  const router = useRouter();

  useEffect(() => {
    async function fetchOrders() {
      try {
        const me = await api<{ user: { email?: string } | null }>('/api/auth/me').catch(() => null);
        if (me?.user?.email) setUserEmail(me.user.email);

        const data = await api<any[]>('/api/orders');
        const formattedOrders = data.map((order: any) => ({
          id: order.id,
          orderNumber: order.order_number,
          email: order.email || me?.user?.email || '',
          date: order.created_at,
          status: order.status,
          total: Number(order.total) || 0,
          items: (order.order_items || []).map((item: any) => ({
            id: item.id,
            productId: item.product_id || null,
            name: item.product_name,
            image: item.metadata?.image || '/logo.png',
            quantity: item.quantity,
            price: Number(item.unit_price) || 0,
            variant: item.variant_name || null,
            slug: item.metadata?.slug || '',
          })),
        }));
        setOrders(formattedOrders);
      } catch (err) {
        console.error('Error fetching orders:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'shipped':
        return 'bg-store-primary/15 text-store-primary';
      case 'processing':
        return 'bg-yellow-100 text-yellow-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleReorder = async (order: Order) => {
    setReorderingId(order.id);
    try {
      let added = 0;
      for (const item of order.items) {
        if (!item.productId) continue;
        try {
          const key = item.slug || item.productId;
          if (!key) continue;
          const product = await api<any>(`/api/storefront/products/${encodeURIComponent(key)}`);
          if (!product?.id || product.status === 'archived' || product.status === 'draft') continue;
          const qty = Number(product.quantity ?? product.stock ?? 0);
          if (qty <= 0 && product.inStock === false) continue;

          const image =
            product.product_images?.[0]?.url ||
            product.images?.[0]?.url ||
            item.image ||
            '/logo.png';
          const price = Number(product.sale_price ?? product.price ?? item.price) || 0;

          addToCart({
            id: product.id || item.productId,
            name: product.name || item.name,
            price,
            image,
            quantity: Math.max(1, item.quantity),
            variant: item.variant || undefined,
            slug: product.slug || item.slug || product.id || item.productId,
            maxStock: Math.max(1, qty || item.quantity || 1),
            moq: Number(product.moq || product.min_order_quantity || 1) || 1,
          });
          added += 1;
        } catch {
          /* skip unavailable lines */
        }
      }

      if (added === 0) {
        window.alert('None of the items from this order are available to reorder right now.');
        return;
      }
      setIsCartOpen(true);
      router.push('/cart');
    } finally {
      setReorderingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <i className="ri-loader-4-line animate-spin text-3xl text-store-primary" />
        <p className="mt-2 text-gray-500">Loading orders...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="py-12 text-center bg-white rounded-lg border border-gray-200">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ri-shopping-bag-line text-3xl text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No orders yet</h3>
        <p className="text-gray-500 mb-6">Start shopping to see your orders here.</p>
        <Link
          href="/shop"
          className="inline-block bg-store-navy text-white px-6 py-2 rounded-lg font-medium hover:bg-store-navy-light transition-colors"
        >
          Go to Shop
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Order History</h2>
        <div className="text-sm text-gray-600">
          Total Orders: <span className="font-bold text-gray-900">{orders.length}</span>
        </div>
      </div>

      <div className="space-y-6">
        {orders.map((order) => {
          const trackEmail = order.email || userEmail;
          const trackHref = trackEmail
            ? `/order-tracking?order=${encodeURIComponent(order.orderNumber)}&email=${encodeURIComponent(trackEmail)}`
            : `/order-tracking?order=${encodeURIComponent(order.orderNumber)}`;
          const helpHref = `/contact?order=${encodeURIComponent(order.orderNumber)}&subject=${encodeURIComponent(`Help with order ${order.orderNumber}`)}`;

          return (
            <div key={order.id} className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4">
                  <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 sm:gap-6 w-full sm:w-auto">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Order Number</p>
                      <p className="font-bold text-gray-900">{order.orderNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Date</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(order.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Total</p>
                      <p className="font-bold text-store-primary">GH₵{order.total.toFixed(2)}</p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(order.status)}`}
                  >
                    {order.status}
                  </span>
                </div>
              </div>

              <div className="p-6">
                <div className="space-y-4 mb-4">
                  {order.items.map((item) => (
                    <div key={`${order.id}-${item.id}`} className="flex space-x-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                      />
                      <div>
                        <p className="font-semibold text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                        <p className="text-sm font-bold text-gray-900 mt-1">GH₵{item.price.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-4 border-t border-gray-200">
                  <Link
                    href={trackHref}
                    className="flex-1 sm:flex-none text-center px-4 py-2 bg-store-navy text-white rounded-lg font-semibold hover:bg-store-navy-light transition-colors whitespace-nowrap"
                  >
                    <i className="ri-map-pin-line mr-2" />
                    Track Order
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleReorder(order)}
                    disabled={reorderingId === order.id}
                    className="flex-1 sm:flex-none px-4 py-2 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    <i className="ri-refresh-line mr-2" />
                    {reorderingId === order.id ? 'Adding…' : 'Reorder'}
                  </button>
                  <Link
                    href={`/account/invoice/${order.id}?print=true`}
                    className="flex-1 sm:flex-none text-center px-4 py-2 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    <i className="ri-download-line mr-2" />
                    Invoice
                  </Link>
                  <Link
                    href={helpHref}
                    className="flex-1 sm:flex-none text-center px-4 py-2 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    <i className="ri-customer-service-line mr-2" />
                    Get Help
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
