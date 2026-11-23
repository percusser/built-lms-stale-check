export function createHybridModel(onDevice, cloud) {
  let deviceState;

  async function deviceReady() {
    deviceState ??= (await onDevice.status()).state;
    return deviceState === 'available';
  }

  return {
    id: 'hybrid',
    label: onDevice.label,
    cloudLabel: cloud.label,
    hybrid: true,
    async status() {
      const device = await onDevice.status();
      deviceState = device.state;
      const remote = await cloud.status();
      return { ...device, cloud: remote.state === 'available' };
    },
    async prepare() {
      try {
        await onDevice.prepare();
      } catch {}
      deviceState = undefined;
      await cloud.prepare().catch(() => {});
    },
    async generate(request) {
      let fallback = 'needs_cloud';
      if (!request.meta?.needsCloud && (await deviceReady())) {
        const local = await onDevice.generate(request);
        if (!local.reason) return local;
        fallback = local.reason;
      }
      const remote = await cloud.generate({ ...request, meta: { ...request.meta, needsCloud: true } });
      return remote.reason ? { ...remote, reason: remote.reason === 'needs_cloud' ? fallback : remote.reason } : { ...remote, fallback };
    },
    saveFlags(flags) {
      return cloud.saveFlags(flags);
    },
  };
}
