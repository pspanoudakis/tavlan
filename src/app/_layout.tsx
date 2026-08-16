import { Stack } from "expo-router";

export default function RootLayout() {
  // No native header: there is a single screen, nothing to navigate back to,
  // and it draws its own title. The default header just showed the route name.
  return <Stack screenOptions={{ headerShown: false }} />;
}
