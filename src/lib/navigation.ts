import { router, type Href } from 'expo-router';

/** Goes back when there is history (e.g. not opened from a deep link); otherwise replaces with `fallback`. */
export function goBackOr(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
