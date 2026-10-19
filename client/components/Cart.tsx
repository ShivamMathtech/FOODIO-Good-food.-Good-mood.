import { ArrowRight, ShoppingBag, Trash2 } from 'lucide-react';
import { errorMessage, money, navigate } from '../api';
import { useApp } from '../context';
import { Stepper } from './ui';
export function Cart() {
  const app = useApp();
  const total = app.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  return (
    <aside className="basket">
      <div className="section-heading">
        <h2>
          Your basket <span className="count">{app.cart.reduce((s, i) => s + i.quantity, 0)}</span>
        </h2>
        <ShoppingBag size={21} />
      </div>
      {!app.cart.length ? (
        <div className="basket-empty">
          <div className="empty-icon">
            <ShoppingBag size={35} />
          </div>
          <h3>A little empty in here</h3>
          <p>
            Find something you love.
            <br />
            We’ll keep it right here.
          </p>
        </div>
      ) : (
        <>
          <p className="muted tiny">Freshly made. Ready when you are.</p>
          <div className="basket-items">
            {app.cart.map((i) => (
              <div className="basket-item" key={i.item_id}>
                <img src={i.image} alt="" />
                <div>
                  <h4>{i.name}</h4>
                  <div className="row">
                    <span>{money(i.price * i.quantity)}</span>
                    <Stepper id={i.item_id} quantity={i.quantity} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="totals">
            <div>
              <span>Food total</span>
              <strong>{money(total)}</strong>
            </div>
            <small>Delivery and offers are calculated at checkout.</small>
          </div>
          <button
            className="button full"
            onClick={() => {
              app.setCartOpen(false);
              navigate(app.user ? '/checkout' : '/auth');
            }}
          >
            Continue to checkout
            <ArrowRight size={17} />
          </button>
          <button
            className="text-button clear"
            disabled={app.cartBusy}
            onClick={() => app.clearCart().catch((e) => app.notify(errorMessage(e)))}
          >
            <Trash2 size={13} />
            Clear basket
          </button>
        </>
      )}
      <div className="basket-note">
        <span>✦</span>
        <div>
          <strong>Good food, less waiting.</strong>
          <p>Browse a kitchen. Pick your favorites.</p>
        </div>
      </div>
    </aside>
  );
}
