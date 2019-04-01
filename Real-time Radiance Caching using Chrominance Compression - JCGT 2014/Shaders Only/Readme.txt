File List (in order of execution):

Voxelization Phase:
- ThreeWayBinary, ThreeWayBinaryMerge. Creates a 3-way high-res voxelization
	- DepthBufferVoxelization (Generates the occupancy mask if indirect bounces is 1)
	- BinaryMipmap (Generates the occupancy mask if indirect bounces is more than 1)

GI Phase:
- BufferCRC_Occupancy: Cache points determination. Creates the occupancy volume.
- BufferCRC_Caching: First-bounce radiance field estimation and SH YCoCg compression. This is the initial caching step for 1st indirect bounce
- BufferCRC_Bounce: Secondary diffuse inter-reflections. This is an optional step for secondary indirect bounces.
- BufferCRC_Blend: Temporal blending step for dynamic scenes.
- BufferCRC_Reconstruct: Irradiance reconstruction and decompression. Final step.
