function dishCountForPeople(people) {
  const groups = { upto4: 4, "5-6": 6, "7-8": 8, "9+": 9, "3-5": 5, "6+": 6 };
  const count = groups[people] || Number(people) || 2;
  if (count <= 1) return 3;
  if (count <= 2) return 4;
  if (count <= 5) return 6;
  return 7;
}

function orderDishData(restaurant, people) {
  const dishCount = dishCountForPeople(people);
  const cardDishes = restaurant.dishes.slice(0, dishCount);
  return {
    cardDishes,
    dishHeading: cardDishes.length ? "点菜参考" : ""
  };
}

module.exports = { dishCountForPeople, orderDishData };
