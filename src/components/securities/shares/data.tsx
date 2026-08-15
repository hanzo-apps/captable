import { SecuritiesStatusEnum } from "@/server/captable-api";
import { capitalize } from "lodash-es";

export const statusValues = Object.keys(SecuritiesStatusEnum).map((item) => ({
  label: capitalize(item),
  value: item,
}));
