package org.fadhel.tumoohplatform.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.fadhel.tumoohplatform.Api.ApiResponse;
import org.fadhel.tumoohplatform.model.JobApplication;
import org.fadhel.tumoohplatform.service.JobApplicationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/job-application")
@RequiredArgsConstructor
public class JobApplicationController {

    private final JobApplicationService jobApplicationService;

    @GetMapping("/get")
    public ResponseEntity<?> getAllJobApplications() {
        return ResponseEntity.status(200).body(jobApplicationService.getAllJobApplications());
    }

    @PostMapping("/add/{userId}/{jobId}")
    public ResponseEntity<?> addJobApplication(@PathVariable Long userId, @PathVariable Long jobId, @RequestBody @Valid JobApplication jobApplication) {
        jobApplicationService.addJobApplication(userId, jobId, jobApplication);
        return ResponseEntity.status(200).body(new ApiResponse("Job application added"));
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<?> updateJobApplication(@PathVariable Long id, @RequestBody @Valid JobApplication jobApplication) {
        jobApplicationService.updateJobApplication(id, jobApplication);
        return ResponseEntity.status(200).body(new ApiResponse("Job application updated"));
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> deleteJobApplication(@PathVariable Long id) {
        jobApplicationService.deleteJobApplication(id);
        return ResponseEntity.status(200).body(new ApiResponse("Job application deleted"));
    }
}