export function chooseRideRoute(currentValue,routes,focusId){
  return routes.some(route=>route.id===currentValue)?currentValue:(routes.some(route=>route.id===focusId)?focusId:'');
}