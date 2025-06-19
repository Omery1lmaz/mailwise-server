import request from 'supertest';
import app from '../src/index.js';

describe('Example Controller', () => {
  describe('GET /api/examples', () => {
    it('should return all examples', async () => {
      const response = await request(app)
        .get('/api/examples')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.count).toBeDefined();
      expect(response.body.total).toBeDefined();
    });

    it('should filter examples by status', async () => {
      const response = await request(app)
        .get('/api/examples?status=active')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every(ex => ex.status === 'active')).toBe(true);
    });

    it('should limit results', async () => {
      const response = await request(app)
        .get('/api/examples?limit=1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(1);
    });
  });

  describe('GET /api/examples/:id', () => {
    it('should return an example by ID', async () => {
      const response = await request(app)
        .get('/api/examples/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(1);
      expect(response.body.data.title).toBeDefined();
      expect(response.body.data.description).toBeDefined();
    });

    it('should return 404 for non-existent example', async () => {
      const response = await request(app)
        .get('/api/examples/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Example not found');
    });
  });

  describe('POST /api/examples', () => {
    it('should create a new example', async () => {
      const newExample = {
        title: 'Test Example',
        description: 'This is a test example for testing purposes',
        status: 'active'
      };

      const response = await request(app)
        .post('/api/examples')
        .send(newExample)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(newExample.title);
      expect(response.body.data.description).toBe(newExample.description);
      expect(response.body.data.status).toBe(newExample.status);
      expect(response.body.data.id).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/examples')
        .send({ title: 'Test Example' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Title and description are required');
    });

    it('should use default status when not provided', async () => {
      const newExample = {
        title: 'Test Example',
        description: 'This is a test example for testing purposes'
      };

      const response = await request(app)
        .post('/api/examples')
        .send(newExample)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('active');
    });
  });

  describe('PUT /api/examples/:id', () => {
    it('should update an existing example', async () => {
      const updateData = {
        title: 'Updated Example',
        description: 'This is an updated example',
        status: 'inactive'
      };

      const response = await request(app)
        .put('/api/examples/1')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.description).toBe(updateData.description);
      expect(response.body.data.status).toBe(updateData.status);
    });

    it('should return 404 for non-existent example', async () => {
      const response = await request(app)
        .put('/api/examples/999')
        .send({ title: 'Test' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Example not found');
    });
  });

  describe('DELETE /api/examples/:id', () => {
    it('should delete an existing example', async () => {
      const response = await request(app)
        .delete('/api/examples/2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Example deleted successfully');
      expect(response.body.data.id).toBe(2);
    });

    it('should return 404 for non-existent example', async () => {
      const response = await request(app)
        .delete('/api/examples/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Example not found');
    });
  });
}); 