"use client";

import { ServiceAreaMap } from "@/components/maps/service-area-map";

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
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <div className="section-header">
        <div>
          <div className="kicker">Visual overview</div>
          <h2 style={{ margin: "6px 0 0" }}>Service area map</h2>
          <div className="muted" style={{ marginTop: 8 }}>
            Interactive map of your configured delivery zones. Click anywhere on
            the map to see coordinates.
          </div>
        </div>
      </div>

      <ServiceAreaMap areas={areas} interactive height="480px" />
    </section>
  );
}
