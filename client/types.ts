export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'customer';
}
export interface Restaurant {
  id: number;
  name: string;
  slug: string;
  cuisine: string;
  description: string;
  image: string;
  eta_min: number;
  delivery_fee: number;
  min_order: number;
  is_open: number;
  tag: string;
  featured: number;
  rating: number | null;
  review_count: number;
}
export interface MenuItem {
  id: number;
  restaurant_id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  image: string;
  is_veg: number;
  available: number;
  popular: number;
  restaurant_name?: string;
}
export interface CartItem extends MenuItem {
  item_id: number;
  quantity: number;
}
export interface Address {
  id: number;
  label: string;
  recipient: string;
  phone: string;
  line1: string;
  city: string;
  postal_code: string;
  is_default: number;
}
export interface Offer {
  code: string;
  description: string;
  min_subtotal: number;
  percent: number;
  max_discount: number;
  active?: number;
}
export interface Quote {
  items: CartItem[];
  restaurant: Restaurant;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  total: number;
  coupon: string | null;
  minimum_met: boolean;
}
export type Status =
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';
export interface Order {
  id: string;
  restaurant_id: number;
  restaurant_name: string;
  restaurant_image: string;
  status: Status;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  total: number;
  coupon_code: string | null;
  address: Address;
  note: string;
  payment_method: 'cod';
  payment_status: 'pending' | 'collected' | 'cancelled';
  created_at: string;
  updated_at: string;
  items: { item_id: number; name: string; price: number; quantity: number }[];
  events: { status: Status; created_at: string }[];
  review: { rating: number; comment: string } | null;
}
export interface Review {
  name: string;
  rating: number;
  comment: string;
  created_at: string;
}
