export type StatusTone = "default" | "success" | "warning";

export type MockOrder = {
  id: string;
  customer: string;
  item: string;
  date: string;
  total: string;
  status: string;
  tone: StatusTone;
};

export type MockProduct = {
  id: string;
  name: string;
  category: string;
  price: string;
  status: string;
  tone: StatusTone;
};
