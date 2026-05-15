import { createServiceArea, updateServiceArea } from "@/lib/service-areas/actions";
import type { ServiceAreaAdminRecord } from "@/lib/data/service-areas-admin";
import { ServiceAreaForm } from "@/components/service-areas/service-area-form";
import { ServiceAreaArchiveButton } from "@/components/service-areas/service-area-archive-button";
import { getMessages } from "@/lib/i18n/server";

export async function ServiceAreaManager({ areas }: { areas: ServiceAreaAdminRecord[] }) {
  const m = await getMessages();
  return (
    <div className="list" style={{ marginTop: 16 }}>
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">{m.serviceAreaManager.addKicker}</div>
            <h3 style={{ margin: "6px 0 0" }}>{m.serviceAreaManager.createTitle}</h3>
          </div>
        </div>
        <ServiceAreaForm
          title={m.serviceAreaManager.newAreaTitle}
          action={createServiceArea}
          submitLabel={m.serviceAreaManager.createSubmit}
        />
      </section>

      {areas.length === 0 ? (
        <div className="order-card" style={{ textAlign: "center", padding: 32 }}>
          <strong>{m.serviceAreaManager.noAreas}</strong>
          <div className="muted" style={{ marginTop: 8 }}>
            {m.serviceAreaManager.noAreasBody}
          </div>
        </div>
      ) : (
        areas.map((area) => (
          <section key={area.id} className="panel">
            <div className="section-header">
              <div>
                <div className="kicker">{m.serviceAreaManager.configuredKicker}</div>
                <h3 style={{ margin: "6px 0 0" }}>{area.label}</h3>
              </div>
              <ServiceAreaArchiveButton serviceAreaId={area.id} />
            </div>
            <ServiceAreaForm
              title={m.serviceAreaManager.editTitle}
              action={updateServiceArea}
              submitLabel={m.serviceAreaManager.saveSubmit}
              area={area}
            />
          </section>
        ))
      )}
    </div>
  );
}
