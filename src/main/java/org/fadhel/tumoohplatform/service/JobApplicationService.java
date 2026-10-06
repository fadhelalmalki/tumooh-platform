package org.fadhel.tumoohplatform.service;

import org.fadhel.tumoohplatform.model.Job;
import org.fadhel.tumoohplatform.model.JobApplication;
import org.fadhel.tumoohplatform.model.User;
import org.fadhel.tumoohplatform.repository.JobApplicationRepository;
import org.fadhel.tumoohplatform.repository.JobRepository;
import org.fadhel.tumoohplatform.repository.UserRepository;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;
import org.fadhel.tumoohplatform.Api.ApiException;

import java.time.LocalDateTime;
import java.util.List;


@Service
@RequiredArgsConstructor
public class JobApplicationService {

    private final JobApplicationRepository jobApplicationRepository;
    private final JobRepository jobRepository;
    private final UserRepository userRepository;

    public List<JobApplication> getAllJobApplications() {
        return jobApplicationRepository.findAll();
    }

    public void addJobApplication(Long userId, Long jobId, JobApplication jobApplication) {
        User user = userRepository.findUserById(userId);
        if (user == null) {
            throw new ApiException("User not found");
        }
        
        Job job = jobRepository.findJobById(jobId);
        if (job == null) {
            throw new ApiException("Job not found");
        }
        
        jobApplication.setUser(user);
        jobApplication.setJob(job);
        jobApplication.setCreatedAt(LocalDateTime.now());
        jobApplicationRepository.save(jobApplication);
    }

    public void updateJobApplication(Long id, JobApplication jobApplication) {
        JobApplication old = jobApplicationRepository.findJobApplicationById(id);
        if (old == null) {
            throw new ApiException("Job application not found");
        }
        old.setStatus(jobApplication.getStatus());
        old.setClosedAt(jobApplication.getClosedAt());
        jobApplicationRepository.save(old);
    }

    public void deleteJobApplication(Long id) {
        JobApplication jobApplication = jobApplicationRepository.findJobApplicationById(id);
        if (jobApplication == null) {
            throw new ApiException("Job application not found");
        }
        jobApplicationRepository.delete(jobApplication);
    }
}