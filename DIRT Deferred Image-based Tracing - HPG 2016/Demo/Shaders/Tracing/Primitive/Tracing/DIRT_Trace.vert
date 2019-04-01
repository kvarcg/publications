// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the vertex implementation for the Traversal stage
// First, the shading buffer contents G[k] for the current pixel (gl_FragCoord.xy) are fetched
// Then, a new ray direction is generated (e.g. based on BSDF sampling) and is probability is also retrieved
// The new ray is traced:
// (i) hierarchically in screen space - empty regions are skipped via the depth texture
// (ii) in the depth intervals it intersects in depth space (for each pixel sample) - non intersected depth intervals (buckets) are skipped
// (iii) in the id buffer, for each intersected depth interval, by performing analytic intersection tests between the ray and the stored primitive in the id buffer
// If a hit occurs, a hit record is created in the hit buffer at the intersection location. This way, a rasterization pass can be initiated later on to fetch the shading attributes.
// The hit record also stores the current pixel (gl_FragCoord.xy), as the owner. This way, the interpolated data during the Fetch pass will be stored at the position the tracing started.
// Storing the shading information this way, allows for an easy illumination pass during the last pass, called the Shade pass.
// Finally, the probability is stored in the operators_probabilities texture to be used during the Shade pass for correct path tracing computations
// Note:
// - Since the id buffer can be downscaled, holding primitive data at a tile of size larger than 1x1 pixels (e.g. tile size:2x2 which is lod level 1). So, hierarchical traversal occurs as usual but stops at a higher lod level than 0 (e.g. at lod=1). This is the only practical difference during the Traversal stage.

#version 330 core
layout(location = 0) in vec3 position;
layout(location = 1) in vec2 texcoord0;
out vec2 TexCoord;
uniform mat4 uniform_mvp;			// simple projection matrix for the screen-space pass (this can be optimized out)

void main(void)
{
   gl_Position = uniform_mvp * vec4(position,1);
   TexCoord = vec2(texcoord0.x,texcoord0.y);
}
