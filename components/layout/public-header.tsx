import Link from "next/link";

export function PublicHeader() {
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link href="/" className="logo">
          RentalOS
        </Link>
        <nav className="nav-links">
          <Link href="/inventory">Inventory</Link>
          <Link href="/checkout">Checkout</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/dashboard/deliveries">Deliveries</Link>
          <Link href="/crew/today">Crew</Link>
        </nav>
      </div>
    </header>
  );
}
