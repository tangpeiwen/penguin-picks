const DISH_COUNTS = { "1": 3, "2": 4, "3-5": 6, "6+": 7 };

function dishCountForPeople(people) {
  return DISH_COUNTS[people] || 4;
}

function orderDishData(restaurant, people) {
  const dishCount = dishCountForPeople(people);
  const cardDishes = restaurant.dishes.slice(0, dishCount);
  return {
    cardDishes,
    dishHeading: cardDishes.length ? "点菜参考" : ""
  };
}

module.exports = { DISH_COUNTS, dishCountForPeople, orderDishData };
