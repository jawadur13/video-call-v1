// Server component that handles params
export default async function RoomLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ roomId: string }>;
}) {
  // Validate roomId on server side
  const { roomId } = await params;
  if (!roomId || typeof roomId !== 'string') {
    return <div>Invalid room ID</div>;
  }

  return <>{children}</>;
}
