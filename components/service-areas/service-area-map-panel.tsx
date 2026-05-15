"use client";

import { ServiceAreaMap } from "@/components/maps/service-area-map";
import { useI18n } from "@/lib/i18n/provider";

type ServiceAreaGeo = {
  id: string;
  label: string;
  zipCode: string;
  city?: string;
  state?: string;
  deliveryFee: number;
  minimumOrder: number;
};

type Props = {
  areas: ServiceAreaGeo[];
};

export function ServiceAreaMapPanel({ areas }: Props) {
  const { messages: m } = useI18n();
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <div className="section-header">
        <div>
          <div className="kicker">{m.serviceAreaMap.kicker}</div>
          <h2 style={{ margin: "6px 0 0" }}>{m.serviceAreaMap.title}</h2>
          <div className="muted" style={{ marginTop: 8 }}>
            {m.serviceAreaMap.description}
          </div>
        </div>
      </div>

      <ServiceAreaMap areas={areas} interactive height="480px" />
    </section>
  );
}
