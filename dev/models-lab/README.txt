RTMPose model size work (31 Oct 2026).
quanth.py <in.onnx> <out.onnx> 8 <comma-separated initializers to keep at half precision>
  8-bit weights with a scale per filter (per input channel for kernels 3x3 and up), dequantised in the graph (Cast + Mul).
cmp2.py <reference.onnx> <model.onnx>...  keypoint differences on frames/*.png (192x256 crops), by confidence (SUB=list to use a subset)
qcmp.js <dump A> <dump B>...  whole-pipeline comparison of tracks dumped by tests/rtm_trial_test.js (DUMP=...), matched by time
layers.json: the 99 weight tensors in graph order. Shipped rtmw-m8.onnx keeps groups 0-2 (first 49 tensors) at half precision except
1276, 1285, 1297, 1300, 1312, 1321 (which tested safe at 8 bits).
