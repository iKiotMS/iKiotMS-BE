class DeviceTokenDTO {
  constructor(data = {}) {
    this.token = data.token;
    this.userAgent = data.userAgent;
  }

  validate() {
    if (!this.token || typeof this.token !== "string" || !this.token.trim()) {
      throw new Error("Device token is required");
    }
  }
}

module.exports = DeviceTokenDTO;
