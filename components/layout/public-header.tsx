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
          <Link href="/checkout">Book Now</Link>
          <Link href="/login">Login</Link>
        </nav>
      </div>
    </header>
  );
}
