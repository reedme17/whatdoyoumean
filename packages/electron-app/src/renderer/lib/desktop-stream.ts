export async function createDesktopStream(sourceId: string): Promise<MediaStream> {
  const mediaDevices = navigator.mediaDevices as Navigator["mediaDevices"] & {
    getUserMedia(constraints: MediaStreamConstraints & {
      video?: MediaTrackConstraints & {
        mandatory?: Record<string, string>;
      };
    }): Promise<MediaStream>;
  };

  return mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: sourceId,
      },
    },
  });
}

export function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}
