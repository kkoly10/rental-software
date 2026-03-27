import { createServiceArea, updateServiceArea } from "@/lib/service-areas/actions";
import type { ServiceAreaAdminRecord } from "@/lib/data/service-areas-admin";
import { ServiceAreaForm } from "@/components/service-areas/service-area-form";
import { ServiceAreaArchiveButton } from "@/components/service-areas/service-area-archive-button";

export function ServiceAreaManager({ areas }: { areas: ServiceAreaAdminRecord[] }) {
  return (
    <div className="list" style={{ marginTop: 16 }}>
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Add coverage</div>
            <h3 style={{ margin: "6px 0 0" }}>Create service area</h3>
          </div>
        </div>
        <ServiceAreaForm
          title="New service area"
          action={createServiceArea}
          submitLabel="Create service area"
        />
      </section>

      {areas.length === 0 ? (
        <div className="order-card" style={{ textAlign: "center", padding: 32 }}>
          <strong>No service areas configured</strong>
          <div className="muted" style={{ marginTop: 8 }}>
            Add your first service area to define checkout coverage, delivery fees, and minimum order rules.
          </div>
        </div>
      ) : (
        areas.map((area) => (
          <section key={area.id} className="panel">
            <div className="section-header">
              <div>
                <div className="kicker">Configured area</div>
                <h3 style={{ margin: "6px 0 0" }}>{area.label}</h3>
              </div>
              <ServiceAreaArchiveButton serviceAreaId={area.id} />
            </div>
            <ServiceAreaForm
              title="Edit service area"
              action={updateServiceArea}
              submitLabel="Save service area"
              area={area}
            />
          </section>
        ))
      )}
    </div>
  );
}
