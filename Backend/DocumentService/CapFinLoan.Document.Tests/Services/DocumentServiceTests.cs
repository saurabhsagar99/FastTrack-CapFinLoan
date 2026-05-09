using NUnit.Framework;
using Moq;
using CapFinLoan.Document.Application.DTOs;
using CapFinLoan.Document.Application.Interfaces;
using CapFinLoan.Document.Application.Services;
using CapFinLoan.Document.Domain.Models;
using CapFinLoan.Document.Domain.Enums;
using CapFinLoan.Document.Persistence.Repositories;
using Microsoft.AspNetCore.Http;

namespace CapFinLoan.Document.Tests.Services;

[TestFixture]
public class DocumentServiceTests
{
    private Mock<IDocumentRepository>? _mockRepository;
    private Mock<IFileStorageService>? _mockFileStorage;
    private Mock<IDocumentMessagePublisher>? _mockMessagePublisher;
    private DocumentService? _documentService;

    [SetUp]
    public void Setup()
    {
        _mockRepository = new Mock<IDocumentRepository>();
        _mockFileStorage = new Mock<IFileStorageService>();
        _mockMessagePublisher = new Mock<IDocumentMessagePublisher>();

        _documentService = new DocumentService(
            _mockRepository.Object,
            _mockFileStorage.Object,
            _mockMessagePublisher.Object);
    }

    [Test]
    public async Task UploadDocumentAsync_WithValidPdfFile_SavesAndReturnsDto()
    {
        // Arrange
        var userId = "user123";
        var applicationId = 1;
        var fileName = "test-document.pdf";
        var filePath = "/uploads/app_1/test-document.pdf";

        var mockFile = new Mock<IFormFile>();
        mockFile.Setup(f => f.FileName).Returns(fileName);
        mockFile.Setup(f => f.Length).Returns(1024); // 1 KB
        mockFile.Setup(f => f.OpenReadStream()).Returns(new MemoryStream(new byte[1024]));

        var uploadDto = new UploadDocumentDto
        {
            File = mockFile.Object,
            ApplicationId = applicationId,
            DocumentType = "KYC"
        };

        _mockFileStorage.Setup(fs => fs.SaveFileAsync(
            It.IsAny<Stream>(),
            It.IsAny<string>(),
            It.IsAny<string>()))
            .ReturnsAsync(filePath);

        _mockRepository.Setup(r => r.GetByApplicationIdAsync(applicationId))
            .ReturnsAsync(new List<DocumentEntity>());

        var savedEntity = new DocumentEntity
        {
            Id = 1,
            ApplicationId = applicationId,
            UserId = userId,
            FileName = fileName,
            FilePath = filePath,
            FileType = ".pdf",
            FileSize = 1024,
            DocumentType = DocumentType.KYC,
            IsVerified = false,
            UploadedAt = DateTime.UtcNow
        };

        _mockRepository.Setup(r => r.AddAsync(It.IsAny<DocumentEntity>()))
            .ReturnsAsync(savedEntity);

        // Act
        var result = await _documentService.UploadDocumentAsync(uploadDto, userId);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result.FileName, Is.EqualTo(fileName));
        Assert.That(result.DocumentType, Is.EqualTo("KYC"));
        _mockFileStorage!.Verify(fs => fs.SaveFileAsync(
            It.IsAny<Stream>(),
            It.IsAny<string>(),
            It.IsAny<string>()), Times.Once);
        _mockRepository!.Verify(r => r.AddAsync(It.IsAny<DocumentEntity>()), Times.Once);
    }

    [Test]
    public void UploadDocumentAsync_WithInvalidFileType_ThrowsInvalidOperationException()
    {
        // Arrange
        var userId = "user123";
        var mockFile = new Mock<IFormFile>();
        mockFile.Setup(f => f.FileName).Returns("test-document.exe");
        mockFile.Setup(f => f.Length).Returns(1024);

        var uploadDto = new UploadDocumentDto
        {
            File = mockFile.Object,
            ApplicationId = 1,
            DocumentType = "KYC"
        };

        // Act & Assert
        var ex = Assert.ThrowsAsync<InvalidOperationException>(
            async () => await _documentService.UploadDocumentAsync(uploadDto, userId));
        Assert.That(ex.Message, Contains.Substring("File type not allowed"));
    }

    [Test]
    public void UploadDocumentAsync_WithFileTooLarge_ThrowsInvalidOperationException()
    {
        // Arrange
        var userId = "user123";
        var mockFile = new Mock<IFormFile>();
        mockFile.Setup(f => f.FileName).Returns("large-file.pdf");
        mockFile.Setup(f => f.Length).Returns(6 * 1024 * 1024); // 6 MB, exceeds 5 MB limit

        var uploadDto = new UploadDocumentDto
        {
            File = mockFile.Object,
            ApplicationId = 1,
            DocumentType = "KYC"
        };

        // Act & Assert
        var ex = Assert.ThrowsAsync<InvalidOperationException>(
            async () => await _documentService.UploadDocumentAsync(uploadDto, userId));
        Assert.That(ex.Message, Contains.Substring("exceeds 5 MB limit"));
    }

    [Test]
    public async Task VerifyDocumentAsync_WithValidVerification_MarksDocumentAsVerified()
    {
        // Arrange
        var docId = 1;
        var document = new DocumentEntity
        {
            Id = docId,
            ApplicationId = 1,
            FileName = "test.pdf",
            IsVerified = false
        };

        var verifyDto = new VerifyDocumentDto
        {
            IsVerified = true,
            Remarks = "Document verified successfully"
        };

        _mockRepository.Setup(r => r.GetByIdAsync(docId))
            .ReturnsAsync(document);

        _mockRepository.Setup(r => r.UpdateAsync(It.IsAny<DocumentEntity>()))
            .Returns(Task.CompletedTask);

        _mockMessagePublisher.Setup(p => p.PublishDocumentStatusUpdatedAsync(It.IsAny<DocumentStatusUpdatedEvent>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _documentService.VerifyDocumentAsync(docId, verifyDto);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result.IsVerified, Is.True);
        _mockRepository!.Verify(r => r.UpdateAsync(It.IsAny<DocumentEntity>()), Times.Once);
        _mockMessagePublisher!.Verify(p => p.PublishDocumentStatusUpdatedAsync(It.IsAny<DocumentStatusUpdatedEvent>()), Times.Once);
    }

    [Test]
    public void VerifyDocumentAsync_WithRejectionNoRemarks_ThrowsInvalidOperationException()
    {
        // Arrange
        var docId = 1;
        var document = new DocumentEntity
        {
            Id = docId,
            ApplicationId = 1,
            FileName = "test.pdf"
        };

        var verifyDto = new VerifyDocumentDto
        {
            IsVerified = false,
            Remarks = "" // Missing remarks for rejection
        };

        _mockRepository.Setup(r => r.GetByIdAsync(docId))
            .ReturnsAsync(document);

        // Act & Assert
        var ex = Assert.ThrowsAsync<InvalidOperationException>(
            async () => await _documentService.VerifyDocumentAsync(docId, verifyDto));
        Assert.That(ex.Message, Contains.Substring("Remarks are required"));
    }

    [Test]
    public async Task GetDocumentsByApplicationAsync_ReturnsListOfDocuments()
    {
        // Arrange
        var applicationId = 1;
        var documents = new List<DocumentEntity>
        {
            new DocumentEntity { Id = 1, ApplicationId = applicationId, FileName = "doc1.pdf" },
            new DocumentEntity { Id = 2, ApplicationId = applicationId, FileName = "doc2.pdf" }
        };

        _mockRepository.Setup(r => r.GetByApplicationIdAsync(applicationId))
            .ReturnsAsync(documents);

        // Act
        var result = await _documentService.GetDocumentsByApplicationAsync(applicationId);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result.Count(), Is.EqualTo(2));
    }
}
