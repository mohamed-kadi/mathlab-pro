package com.mathlabpro.math;

import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/math")
public class MathController {

    private final MathEngineService mathEngineService;

    public MathController(MathEngineService mathEngineService) {
        this.mathEngineService = mathEngineService;
    }

    @PostMapping("/polynomial")
    public Map<String, Object> polynomial(@RequestBody Map<String, Object> request) {
        return mathEngineService.polynomial(request);
    }

    @PostMapping("/algebra")
    public Map<String, Object> algebra(@RequestBody Map<String, Object> request) {
        return mathEngineService.algebra(request);
    }

    @PostMapping("/matrix")
    public Map<String, Object> matrix(@RequestBody Map<String, Object> request) {
        return mathEngineService.matrix(request);
    }

    @PostMapping("/numerical")
    public Map<String, Object> numerical(@RequestBody Map<String, Object> request) {
        return mathEngineService.numerical(request);
    }

    @PostMapping("/calculus")
    public Map<String, Object> calculus(@RequestBody Map<String, Object> request) {
        return mathEngineService.calculus(request);
    }

    @PostMapping("/statistics")
    public Map<String, Object> statistics(@RequestBody Map<String, Object> request) {
        return mathEngineService.statistics(request);
    }
}
