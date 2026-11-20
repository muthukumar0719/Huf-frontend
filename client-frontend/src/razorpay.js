const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loading;

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.onload = resolve;
    script.onerror = () => {
      loading = null;
      reject(new Error("Could not load the payment window. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });
  return loading;
}

// Resolves with Razorpay's {razorpay_order_id, razorpay_payment_id, razorpay_signature}.
// A failed attempt keeps the checkout open for a retry, so it only calls onFailure;
// closing the checkout rejects.
export async function payWithRazorpay(order, onFailure) {
  await loadCheckout();
  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "AIONION Capital",
      description: order.description,
      prefill: order.prefill,
      theme: { color: "#0023FF" },
      handler: resolve,
      modal: { ondismiss: () => reject(new Error("Payment was not completed. You can try again.")) },
    });
    checkout.on("payment.failed", (e) =>
      onFailure(e.error?.description || "Payment failed. Try again or use another method.", e.error),
    );
    checkout.open();
  });
}
