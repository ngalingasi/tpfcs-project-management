import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { transfersApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';
import { useAuth } from '../../store/authStore';

const STATUS_STEPS = ['draft','approved','dispatched','under_inspection','inspection_approved','received','closed'];
const STATUS_STYLES: Record<string,string> = {
  draft:'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  approved:'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  dispatched:'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  under_inspection:'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  inspection_approved:'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400',
  received:'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  closed:'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  cancelled:'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
};

// What each status means & next action
const STATUS_GUIDE: Record<string,{desc:string;next?:string}> = {
  draft:              { desc: 'Transfer created, awaiting approval',       next: 'Approve to proceed' },
  approved:           { desc: 'Approved, ready to dispatch',               next: 'Dispatch to deduct stock from source store' },
  dispatched:         { desc: 'Stock deducted from source, in transit',    next: transfer_requires_inspection => transfer_requires_inspection ? 'Create Inspection Request at destination' : 'Mark Received directly' },
  under_inspection:   { desc: 'Inspection in progress at destination',     next: 'Complete inspection and submit for approval' },
  inspection_approved:{ desc: 'Inspection approved, stock being added',    next: 'System auto-adds stock to destination store' },
  received:           { desc: 'Stock received at destination store',       next: 'Close transfer to finalise' },
  closed:             { desc: 'Transfer completed and closed',             next: undefined },
  cancelled:          { desc: 'Transfer cancelled',                        next: undefined },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function TransferDetail() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const canManage = ['admin','manager'].includes(user?.role ?? '');

  const [transfer, setTransfer] = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState<string|null>(null);

  const load = () => transfersApi.get(Number(id))
    .then(r => setTransfer(r.data)).catch(() => {}).finally(() => setLoading(false));

  useEffect(() => { if (id) load(); }, [id]);

  const action = async (label: string, fn: () => Promise<any>, confirm_msg?: string) => {
    if (confirm_msg && !confirm(confirm_msg)) return;
    setActing(label);
    try { await fn(); toast.success(`Transfer ${label}`); load(); }
    catch (err: any) { toast.error('Failed', err?.response?.data?.message); }
    finally { setActing(null); }
  };

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
  const fmtQty  = (n: any) => Number(n||0).toLocaleString(undefined,{maximumFractionDigits:4});

  if (loading) return (
    <div className="animate-pulse max-w-4xl mx-auto space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl"/>)}
    </div>
  );
  if (!transfer) return <p className="text-center py-20 text-gray-400">Transfer not found</p>;

  const currentStep = STATUS_STEPS.indexOf(transfer.status);
  const guide = STATUS_GUIDE[transfer.status];
  const nextAction = typeof guide?.next === 'function' ? guide.next(transfer.requires_inspection) : guide?.next;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/inventory/transfers" className="hover:text-brand-500">Transfers</Link>
          <span>/</span>
          <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">{transfer.transfer_number}</span>
        </div>
        <BackButton to="/inventory/transfers"/>
      </div>

      {/* Header card */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold font-mono text-gray-800 dark:text-white">{transfer.transfer_number}</h1>
              <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${STATUS_STYLES[transfer.status] ?? ''}`}>
                {transfer.status.replace(/_/g,' ')}
              </span>
            </div>
            <p className="text-sm text-gray-500">Created by {transfer.created_by_name} · {fmtDate(transfer.created_at)}</p>
            {/* Status guidance */}
            {guide && (
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                <span className="text-gray-400">{guide.desc}</span>
                {nextAction && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <span className="text-brand-600 dark:text-brand-400 font-medium">Next: {nextAction}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          {canManage && (
            <div className="flex gap-2 flex-wrap">
              {transfer.status === 'draft' && (
                <>
                  <button onClick={() => navigate(`/inventory/transfers/${id}/edit`)}
                    className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Edit</button>
                  <button onClick={() => action('approved', () => transfersApi.approve(Number(id)))} disabled={!!acting}
                    className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">Approve</button>
                </>
              )}
              {transfer.status === 'approved' && (
                <button onClick={() => action('dispatched', () => (transfersApi as any).dispatch(Number(id)), 'Dispatch transfer? This will deduct stock from the source store.')} disabled={!!acting}
                  className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
                  {acting === 'dispatched' ? 'Dispatching...' : 'Dispatch'}
                </button>
              )}
              {transfer.status === 'dispatched' && transfer.requires_inspection && (
                <button onClick={() => navigate(`/inspection/requests/new?source_type=TRANSFER&source_id=${id}`)}
                  className="px-4 py-2 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                  Create Inspection
                </button>
              )}
              {transfer.status === 'dispatched' && !transfer.requires_inspection && (
                <button onClick={() => action('received', () => (transfersApi as any).receive(Number(id)), 'Mark as received? This will add stock to the destination store.')} disabled={!!acting}
                  className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50">
                  {acting === 'received' ? 'Processing...' : 'Mark Received'}
                </button>
              )}
              {transfer.status === 'received' && (
                <button onClick={() => action('closed', () => (transfersApi as any).close(Number(id)), 'Close this transfer? This action is final.')} disabled={!!acting}
                  className="px-4 py-2 text-sm bg-gray-700 text-white dark:bg-gray-600 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-500 disabled:opacity-50 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  {acting === 'closed' ? 'Closing...' : 'Close Transfer'}
                </button>
              )}
              {!['cancelled','closed','received'].includes(transfer.status) && (
                <button onClick={() => action('cancelled', () => (transfersApi as any).cancel(Number(id)), 'Cancel this transfer?')} disabled={!!acting}
                  className="px-4 py-2 text-sm text-red-600 border border-red-200 dark:border-red-500/30 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50">Cancel</button>
              )}
            </div>
          )}
        </div>

        {/* Status timeline */}
        <div className="flex items-start gap-0 overflow-x-auto pb-2 mt-2">
          {STATUS_STEPS.map((step, i) => {
            const done    = i < currentStep;
            const current = i === currentStep;
            return (
              <div key={step} className="flex items-center flex-shrink-0">
                <div className="flex flex-col items-center min-w-[80px]">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                    done    ? 'bg-green-500 border-green-500 text-white' :
                    current ? 'bg-brand-500 border-brand-500 text-white' :
                    'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-400'
                  }`}>{done ? '✓' : i+1}</div>
                  <span className={`text-[9px] mt-1 text-center capitalize leading-tight ${current ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-gray-400'}`}>
                    {step.replace(/_/g,' ')}
                  </span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`h-0.5 w-8 flex-shrink-0 mx-0.5 mb-4 ${done ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`}/>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Store cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <p className="text-xs text-gray-400 mb-1 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            From (Source)
          </p>
          <p className="text-base font-bold text-gray-800 dark:text-white">{transfer.source_store_name}</p>
          {transfer.source_region && <p className="text-xs text-gray-400 mt-0.5">{transfer.source_region}</p>}
          {transfer.dispatched_at && <p className="text-xs text-gray-400 mt-1">Dispatched: {fmtDate(transfer.dispatched_at)}</p>}
        </div>
        <div className="rounded-xl border border-brand-200 dark:border-brand-500/30 bg-brand-50/20 dark:bg-brand-500/5 p-5">
          <p className="text-xs text-brand-500 mb-1 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            To (Destination)
          </p>
          <p className="text-base font-bold text-gray-800 dark:text-white">{transfer.destination_store_name}</p>
          {transfer.destination_region && <p className="text-xs text-gray-400 mt-0.5">{transfer.destination_region}</p>}
          {transfer.received_at && <p className="text-xs text-green-600 dark:text-green-400 mt-1">Received: {fmtDate(transfer.received_at)}</p>}
        </div>
      </div>

      {/* Transfer items */}
      <Section title={`Transfer Items (${transfer.items?.length ?? 0})`}>
        {!transfer.items?.length ? (
          <p className="text-sm text-gray-400">No items</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-gray-800">
                {['Product','SKU','Unit','Transfer Qty','Source Stock'].map(h =>
                  <th key={h} className="text-left pb-2 pr-4 font-medium">{h}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {transfer.items.map((item: any) => (
                <tr key={item.transfer_item_id}>
                  <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-white">{item.product_name}</td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-gray-400">{item.sku_barcode || '—'}</td>
                  <td className="py-2.5 pr-4 text-gray-500">{item.unit_type || '—'}</td>
                  <td className="py-2.5 pr-4 font-bold text-brand-600 dark:text-brand-400">{fmtQty(item.quantity)}</td>
                  <td className="py-2.5 text-gray-500">{item.current_stock != null ? fmtQty(item.current_stock) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Transit info — only show if enabled AND has actual data */}
      {transfer.requires_transit && (
        <Section title="Transit / Logistics">
          {(() => {
            const fields = [
              { label: 'Method',           value: transfer.transit_method || null },
              { label: 'Provider',         value: transfer.transit_provider || null },
              { label: 'Tracking #',       value: transfer.tracking_number || null },
              { label: 'Expected Arrival', value: transfer.expected_arrival_date ? fmtDate(transfer.expected_arrival_date) : null },
              { label: 'Vehicle',          value: transfer.vehicle_information || null },
              { label: 'Driver',           value: transfer.driver_information || null },
            ].filter(f => f.value !== null);
            return fields.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                {fields.map(item => (
                  <div key={item.label}>
                    <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
                    <p className="font-medium text-gray-800 dark:text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">No logistics details provided</p>;
          })()}
          {transfer.logistics_notes && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-400 mb-1">Logistics Notes</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{transfer.logistics_notes}</p>
            </div>
          )}
        </Section>
      )}

      {transfer.notes && (
        <Section title="Notes">
          <p className="text-sm text-gray-600 dark:text-gray-400">{transfer.notes}</p>
        </Section>
      )}
    </div>
  );
}
