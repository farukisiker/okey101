import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export type PickResult = { uri: string } | { cancelled: true } | { permission: false };

/** Picks (or takes) a square photo and shrinks it to a 256x256 JPEG, ready to upload. */
export async function pickProfilePhoto(source: 'gallery' | 'camera'): Promise<PickResult> {
  const perm =
    source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { permission: false };
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets[0]) return { cancelled: true };
  const ref = await ImageManipulator.manipulate(res.assets[0].uri).resize({ width: 256, height: 256 }).renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return { uri: out.uri };
}
