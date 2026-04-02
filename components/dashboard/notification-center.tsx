"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Notification, NotificationType } from "@/lib/data/notifications";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/messages/actions";

function NotificationIcon({ type }: { type: NotificationType }) {
  switch (type) {
    case "new_order":
      return (
        <svg className="notif-icon notif-icon-order" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 01-8 0" />
        </svg>
      );
    case "payment_received":
      return (
        <svg className="notif-icon notif-icon-payment" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
      );
    case "order_confirmed":
      return (
        <svg className="notif-icon notif-icon-confirmed" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case "delivery_scheduled":
      return (
        <svg className="notif-icon notif-icon-delivery" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      );
    case "new_customer":
      return (
        <svg className="notif-icon notif-icon-customer" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      );
    case "new_message":
      return (
        <svg className="notif-icon notif-icon-order" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      );
    case "low_inventory":
      return (
        <svg className="notif-icon notif-icon-inventory" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
  }
}

export function NotificationCenter({
  initialNotifications,
}: {
  initialNotifications: Notification[];
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>(initialNotifications);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = items.filter((n) => !n.read).length;

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleClickOutside]);

  function handleMarkAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    markAllNotificationsRead().catch(() => {});
  }

  function handleMarkRead(id: string) {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    // Only persist for real DB notifications (not demo ones)
    if (!id.startsWith("demo-")) {
      markNotificationRead(id).catch(() => {});
    }
  }

  return (
    <div className="notif-center" ref={ref}>
      <button
        type="button"
        className="notif-bell-btn"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      <div className={`notif-dropdown ${open ? "notif-dropdown-open" : ""}`}>
        <div className="notif-dropdown-header">
          <span className="notif-dropdown-title">Notifications</span>
          {unreadCount > 0 && (
            <button
              type="button"
              className="notif-mark-all-btn"
              onClick={handleMarkAllRead}
            >
              Mark all as read
            </button>
          )}
        </div>

        <div className="notif-dropdown-body">
          {items.length === 0 ? (
            <div className="notif-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p>You&apos;re all caught up!</p>
            </div>
          ) : (
            items.map((item) => {
              const inner = (
                <>
                  <div className="notif-item-icon">
                    <NotificationIcon type={item.type} />
                  </div>
                  <div className="notif-item-content">
                    <div className="notif-item-title">{item.title}</div>
                    <div className="notif-item-desc">{item.description}</div>
                  </div>
                  <div className="notif-item-time">{item.timestamp}</div>
                  {!item.read && <span className="notif-item-dot" />}
                </>
              );

              if (item.link) {
                return (
                  <a
                    key={item.id}
                    href={item.link}
                    className={`notif-item ${!item.read ? "notif-item-unread" : ""}`}
                    onClick={() => handleMarkRead(item.id)}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    {inner}
                  </a>
                );
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`notif-item ${!item.read ? "notif-item-unread" : ""}`}
                  onClick={() => handleMarkRead(item.id)}
                >
                  {inner}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
