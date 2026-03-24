import { getOrders } from "@/lib/data/orders";
import { getPayments } from "@/lib/data/payments";
import { getProducts } from "@/lib/data/products";

export async function getDashboardSummary() {
  const [orders, payments, products] = await Promise.all([
    getOrders(),
    getPayments(),
    getProducts(),
  ]);

  return {
    todayBookings: orders.length,
    upcomingDeliveries: Math.max(orders.length - 1, 0),
    activeProducts: products.length,
    paymentItems: payments.length,
    recentOrders: orders.slice(0, 3),
  };
}
