import { Copy, Tag } from 'lucide-react';
import { useResource } from '../hooks';
import { useApp } from '../context';
import { Empty, ErrorState, Loading } from '../components/ui';
import type { Offer } from '../types';
export function Offers() {
  const { notify } = useApp();
  const r = useResource<{ offers: Offer[] }>('/offers');
  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      notify('Copied ' + code + '. Apply it at checkout.');
    } catch {
      notify('Enter ' + code + ' at checkout.');
    }
  }
  return (
    <>
      <div className="page-title">
        <span className="overline">A LITTLE EXTRA HAPPINESS</span>
        <h1>Good food. Better deals.</h1>
        <p>Pick a code and bring it along to checkout.</p>
      </div>
      {r.loading ? (
        <Loading />
      ) : r.error ? (
        <ErrorState message={r.error} retry={r.reload} />
      ) : r.data?.offers.length ? (
        <div className="offers-grid">
          {r.data.offers.map((o) => (
            <article className="offer-card" key={o.code}>
              <Tag size={28} />
              <h2>{o.percent}% off</h2>
              <p>{o.description}</p>
              <button className="coupon-code" onClick={() => copy(o.code)}>
                {o.code}
                <Copy size={17} />
              </button>
              <small>One code per order. Discount applies to food only.</small>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Good things are cooking" detail="Check back soon for new offers." />
      )}
      <a className="button" href="#/">
        Find something delicious
      </a>
    </>
  );
}
