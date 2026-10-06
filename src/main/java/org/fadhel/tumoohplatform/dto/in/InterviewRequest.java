package org.fadhel.tumoohplatform.dto.in;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.*;
import java.time.LocalDateTime;

@Getter 
@Setter 
@NoArgsConstructor 
@AllArgsConstructor
public class InterviewRequest {
    
    @NotNull(message = "Job application ID is required")
    private Long jobApplicationId;

    @NotNull(message = "User ID is required")
    private Long userId;

    @NotNull(message = "Interview date and time are required")
    private LocalDateTime interviewDate;

    @Pattern(regexp = "^(PENDING|SCHEDULED|COMPLETED|CANCELLED|RESCHEDULED)$",
        message = "Status must be one of: PENDING, SCHEDULED, COMPLETED, CANCELLED, RESCHEDULED"
    )
    private String status;
}