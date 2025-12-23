// Minimal no-op stub for React Native AsyncStorage, used only to satisfy
// MetaMask SDK's optional dependency when running in a web/Next.js context.

module.exports = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
  clear: async () => {},
};
