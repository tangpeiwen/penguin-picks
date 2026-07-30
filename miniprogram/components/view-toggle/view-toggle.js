Component({
  properties: {
    value: {
      type: String,
      value: "list"
    },
    mapDisabled: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    choose(event) {
      const value = event.currentTarget.dataset.value;
      if (value === "map" && this.data.mapDisabled) {
        this.triggerEvent("unavailable");
        return;
      }
      if (value !== this.data.value) this.triggerEvent("change", { value });
    }
  }
});
