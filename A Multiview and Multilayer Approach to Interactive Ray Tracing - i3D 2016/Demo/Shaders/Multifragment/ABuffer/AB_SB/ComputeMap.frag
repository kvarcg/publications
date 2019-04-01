// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// S-Buffer fragment implementation of Compute Map stage
// S-buffer: Sparsity-aware Multi-fragment Rendering (Short Eurographics 2012)
// http://dx.doi.org/10.2312/conf/EG2012/short/101-104
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"
#include "s-buffer.h"

//	layout(binding = 3, std430)	coherent  buffer  address_s { uint head_s[]; };
	//layout(binding = 4, std430)	coherent  buffer  address_f { uint head_f[]; };

	void main(void)
	{
		//int id = int(gl_FragCoord.y);
		//if(id < 1)
		{
			uint sum = 0U;
			//for(int i = id; i > 0; i--)
				//sum += head_s[i-1];
			//head_f[0] = sum;
		}
	}