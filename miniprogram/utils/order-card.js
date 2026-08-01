function orderDishData(restaurant) {
  const cardDishes = Array.isArray(restaurant.dishes) ? restaurant.dishes.slice() : [];
  return {
    cardDishes,
    dishHeading: cardDishes.length ? (restaurant.visited === false ? "想点这些" : "点菜参考") : ""
  };
}

module.exports = { orderDishData };
