// Real-time Radiance Caching using Chrominance Compression (JCGT)
// http://jcgt.org/published/0003/04/06/
// Authors: K. Vardis, G. Papaioannou, A. Gkaravelis

Demo requirements:
64-bit
OpenGL 4.2 (for the demo) - OpenGL 3.3 is needed with atomic counters disabled
Visual C++ 2012 x64 redistributable (in the redist folder)

Demo key bindings:

Arrow keys: User Movement on camera UW axis
PgUp/PgDn: User Movement on camera V axis
Mouse (with left button clicked):  Rotation on UV axis

9 - Change GI quality (Uncompressed, Y3Co2Cg2, Y3Co1Cg1)
0 - Change GI indirect occlusion status
- - Increase GI bounces
= - Decrease GI bounces
J - Toggle Alchemy AO (used for capturing small-scale details for illustration purposes)
K - Change lighting mode (emission-direct-indirect)
R - Reload shaders
L - Toggle Materials
F7 - print GI voxelizer (see Notes)
F8 - enable/disable screen space fonts
F9 - Pause/Resume GI
F10 - Toggle GI Occupancy Optimization
ESC - Quit

Voxelizer Output Notes:
The files are stored in the EngineData/Voxelizer folder 
The voxelizer writes two files in .asc and .obj format. 
The .asc files are viewable with MeshLab as point clouds (uncheck grid triangulation during import)
The .obj files are viewable with any obj viewer as cubes (3D Studio Max, Assimp Viewer, etc.)
If GI is set to single bounce then the Geometry Volume, the Depth Occupancy Volume and the Dilated volume (CRC) are written
If GI is set to multi bounce then the Geometry Volume (mip0), the Occupancy Volume(mip2) and the Dilated volume (CRC) are written

Timing Notes:
All displayed timers are measured using the OpenGL Query timers (GL_TIME_ELAPSED).
Using atomics in the occupancy stage comes at a small overhead of about ~0.1ms. These are used for displaying the number of occupied voxels in this demo. This is the only reason the demo requires OpenGL 4.2. Otherwise, OpenGL 3.3 is required.

GLSL Source Code:
The shader source code is located at Shaders\GI\CRC
The voxelizer source code is located at Shaders\GI\Voxelization (BinaryDownsample, ThreeWayBinary, ThreeWayBinaryMerge and DepthBufferVoxelization)