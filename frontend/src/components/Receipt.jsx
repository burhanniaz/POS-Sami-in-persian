// Printable receipt. Only this component's markup is visible when printing —
// see the @media print rules in index.css that hide everything else on the page.
// Works with any printer set up in the OS (USB, Bluetooth, or network thermal
// printers all show up as a normal Windows/Mac printer once their driver is
// installed) since it just uses the browser's native print dialog.
export default function Receipt({ store, sale, items, customer, discount, paidCash, paidLoan, printable = false }) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const total = Math.max(subtotal - Number(discount || 0), 0);

  return (
    <div id={printable ? 'receipt-print' : undefined} className="font-tabular text-black bg-white p-2 w-full max-w-[80mm] mx-auto text-xs leading-relaxed">
      <div className="text-center mb-2">
        <div className="font-bold text-sm">{store?.store_name || 'فروشگاه'}</div>
        {store?.address && <div>{store.address}</div>}
        {store?.phone && <div className="font-tabular">{store.phone}</div>}
      </div>

      <div className="border-t border-dashed border-black my-1" />

      <div className="flex justify-between">
        <span>شماره فاکتور</span>
        <span className="font-tabular">{sale.invoice_no}</span>
      </div>
      <div className="flex justify-between">
        <span>تاریخ</span>
        <span className="font-tabular">{new Date(sale.created_at).toLocaleString('en-US')}</span>
      </div>
      {customer && (
        <div className="flex justify-between">
          <span>مشتری</span>
          <span>{customer.name}</span>
        </div>
      )}

      <div className="border-t border-dashed border-black my-1" />

      {items.map((item) => (
        <div key={item.product_id} className="mb-1">
          <div>{item.name}</div>
          <div className="flex justify-between font-tabular">
            <span>{item.quantity.toLocaleString('en-US')} x {item.price.toLocaleString('en-US')}</span>
            <span>{(item.price * item.quantity).toLocaleString('en-US')}</span>
          </div>
        </div>
      ))}

      <div className="border-t border-dashed border-black my-1" />

      <div className="flex justify-between">
        <span>جمع جزء</span>
        <span className="font-tabular">{subtotal.toLocaleString('en-US')}</span>
      </div>
      {Number(discount) > 0 && (
        <div className="flex justify-between">
          <span>تخفیف</span>
          <span className="font-tabular">-{Number(discount).toLocaleString('en-US')}</span>
        </div>
      )}
      <div className="flex justify-between font-bold text-sm">
        <span>مجموع</span>
        <span className="font-tabular">{total.toLocaleString('en-US')}</span>
      </div>

      <div className="border-t border-dashed border-black my-1" />

      <div className="flex justify-between">
        <span>پرداخت نقدی</span>
        <span className="font-tabular">{Number(paidCash).toLocaleString('en-US')}</span>
      </div>
      {Number(paidLoan) > 0 && (
        <div className="flex justify-between">
          <span>به صورت نسیه</span>
          <span className="font-tabular">{Number(paidLoan).toLocaleString('en-US')}</span>
        </div>
      )}

      {store?.receipt_footer && (
        <>
          <div className="border-t border-dashed border-black my-1" />
          <div className="text-center mt-2 whitespace-pre-wrap">{store.receipt_footer}</div>
        </>
      )}
    </div>
  );
}
